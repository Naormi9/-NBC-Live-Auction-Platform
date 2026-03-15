import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.database();

const DEFAULT_SETTINGS = {
  round1: { increment: 1000, timerSeconds: 45 },
  round2: { increment: 500, timerSeconds: 30 },
  round3: { increment: 250, timerSeconds: 30 },
};

export const processBid = functions.region('europe-west1').database
  .ref('/pending_bids/{bidId}')
  .onCreate(async (snapshot, context) => {
    const bid = snapshot.val();
    if (!bid) return;

    // Always clean up the pending bid, regardless of outcome
    const cleanup = () => snapshot.ref.remove();

    // Validate required bid fields
    if (typeof bid.itemId !== 'string' || typeof bid.auctionId !== 'string' ||
        typeof bid.userId !== 'string' || typeof bid.amount !== 'number' ||
        bid.amount <= 0 || !bid.userDisplayName) {
      console.error('Invalid bid data:', JSON.stringify(bid));
      await cleanup();
      return;
    }

    // Idempotency: check if this exact bid was already processed
    // (same user, same item, same amount — within last 5 seconds)
    const recentBidsSnap = await db.ref(`/bid_history/${bid.auctionId}/${bid.itemId}`)
      .orderByChild('userId')
      .equalTo(bid.userId)
      .limitToLast(1)
      .once('value');
    if (recentBidsSnap.exists()) {
      const entries = Object.values(recentBidsSnap.val()) as any[];
      const last = entries[0];
      if (last && last.amount === bid.amount && last.timestamp && (Date.now() - last.timestamp) < 5000) {
        console.warn(`Duplicate bid detected for user ${bid.userId}, amount ${bid.amount}. Skipping.`);
        await cleanup();
        return;
      }
    }

    // Verify user is approved before processing bid
    const userSnap = await db.ref(`/users/${bid.userId}`).once('value');
    const userData = userSnap.val();
    if (!userData || userData.verificationStatus !== 'approved') {
      console.warn(`Rejected bid from non-approved user: ${bid.userId}`);
      await cleanup();
      return;
    }

    const itemRef = db.ref(`/auction_items/${bid.itemId}`);
    const auctionRef = db.ref(`/auctions/${bid.auctionId}`);

    // Get auction data for round settings
    const auctionSnap = await auctionRef.once('value');
    const auction = auctionSnap.val();
    if (!auction || auction.status !== 'live') {
      await cleanup();
      return;
    }

    const round = auction.currentRound as 1 | 2 | 3;
    const roundKey = `round${round}` as 'round1' | 'round2' | 'round3';
    const roundSettings = auction.settings?.[roundKey] || DEFAULT_SETTINGS[roundKey];
    const increment = roundSettings.increment;
    const timerDuration = auction.settings?.timerOverrideSeconds > 0
      ? auction.settings.timerOverrideSeconds
      : roundSettings.timerSeconds;

    // Transaction to update item — atomic, only one bid wins
    const result = await itemRef.transaction((item) => {
      if (!item || item.status !== 'active') return item;

      const minBid = item.currentBid + increment;

      // Rule: minimum bid = currentBid + increment
      if (bid.amount < minBid) return item;

      // Rule: bid must be aligned to increment
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
    await cleanup();
  });
