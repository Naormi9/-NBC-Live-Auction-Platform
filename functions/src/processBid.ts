import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.database();

const DEFAULT_SETTINGS = {
  round1: { increment: 1000, timerSeconds: 45 },
  round2: { increment: 500, timerSeconds: 30 },
  round3: { increment: 250, timerSeconds: 30 },
};

function getTimerSecondsForBid(auction: any, roundKey: 'round1' | 'round2' | 'round3'): number {
  const override = auction.settings?.timerOverrideSeconds;
  if (override && override > 0) return override;
  const roundSettings = auction.settings?.[roundKey] || DEFAULT_SETTINGS[roundKey];
  return roundSettings.timerSeconds;
}

export const processBid = functions.region('europe-west1').database
  .ref('/pending_bids/{bidId}')
  .onCreate(async (snapshot, context) => {
    const bid = snapshot.val();
    if (!bid) return;

    // Validate required bid fields
    if (typeof bid.itemId !== 'string' || typeof bid.auctionId !== 'string' ||
        typeof bid.userId !== 'string' || typeof bid.amount !== 'number' ||
        bid.amount <= 0 || !bid.userDisplayName) {
      console.error('Invalid bid data:', JSON.stringify(bid));
      await snapshot.ref.remove();
      return;
    }

    // Verify user is approved before processing bid
    const userSnap = await db.ref(`/users/${bid.userId}`).once('value');
    const userData = userSnap.val();
    if (!userData || userData.verificationStatus !== 'approved') {
      console.warn(`Rejected bid from non-approved user: ${bid.userId}`);
      await snapshot.ref.remove();
      return;
    }

    const itemRef = db.ref(`/auction_items/${bid.itemId}`);
    const auctionRef = db.ref(`/auctions/${bid.auctionId}`);

    // Get auction data for round settings
    const auctionSnap = await auctionRef.once('value');
    const auction = auctionSnap.val();
    if (!auction || auction.status !== 'live') {
      await snapshot.ref.remove();
      return;
    }

    // Reject bids when timer is paused
    if (auction.timerPaused) {
      console.warn(`Rejected bid during paused timer: ${bid.userId}`);
      await snapshot.ref.remove();
      return;
    }

    // Verify user is registered for this auction
    const regSnap = await db.ref(`/registrations/${bid.auctionId}/${bid.userId}`).once('value');
    if (!regSnap.exists()) {
      console.warn(`Rejected bid from unregistered user: ${bid.userId}`);
      await snapshot.ref.remove();
      return;
    }

    const round = auction.currentRound as 1 | 2 | 3;
    const roundKey = `round${round}` as 'round1' | 'round2' | 'round3';
    const roundSettings = auction.settings?.[roundKey] || DEFAULT_SETTINGS[roundKey];
    const increment = roundSettings.increment;
    const timerDuration = getTimerSecondsForBid(auction, roundKey);

    // Transaction to update item
    const result = await itemRef.transaction((item) => {
      if (!item || item.status !== 'active') return item;

      const minBid = item.currentBid + increment;

      // Rule: minimum bid = currentBid + increment
      if (bid.amount < minBid) return item;

      // Rule: bid must be aligned to increment (e.g., 1000, 2000, not 1500 when increment is 1000)
      if ((bid.amount - item.currentBid) % increment !== 0) return item;

      // Rule: cannot outbid yourself
      if (bid.userId === item.currentBidderId) return item;

      // Accept the bid
      item.currentBid = bid.amount;
      item.currentBidderId = bid.userId;
      item.currentBidderName = bid.userDisplayName;
      return item;
    });

    if (result.committed && result.snapshot.val()) {
      const updatedItem = result.snapshot.val();
      // Only update timer if bid was actually accepted (currentBidderId changed)
      if (updatedItem.currentBidderId === bid.userId) {
        // Reset timer on successful bid
        await auctionRef.update({
          timerEndsAt: Date.now() + timerDuration * 1000,
          timerDuration: timerDuration,
          timerPaused: false,
          // Reset round1Resets counter since a bid came in
          round1Resets: 0,
        });

        // Write to bid_history
        await db.ref(`/bid_history/${bid.auctionId}/${bid.itemId}`).push({
          userId: bid.userId,
          userDisplayName: bid.userDisplayName,
          amount: bid.amount,
          round,
          timestamp: admin.database.ServerValue.TIMESTAMP,
        });

        // System chat message
        await db.ref(`/live_chat/${bid.auctionId}`).push({
          senderId: 'system',
          senderName: 'מערכת',
          senderRole: 'system',
          message: `הצעה התקבלה: ₪${bid.amount.toLocaleString()} מ-${bid.userDisplayName}`,
          timestamp: admin.database.ServerValue.TIMESTAMP,
        });
      }
    }

    // Clean up pending bid
    await snapshot.ref.remove();
  });
