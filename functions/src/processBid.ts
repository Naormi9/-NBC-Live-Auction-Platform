import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.database();
const SERVER_TIMESTAMP = admin.database.ServerValue?.TIMESTAMP ?? { '.sv': 'timestamp' };

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
    const bidId = context.params.bidId;
    const bid = snapshot.val();
    if (!bid) return;

    console.log(`[processBid] START bidId=${bidId} user=${bid?.userId} amount=${bid?.amount} item=${bid?.itemId}`);

    // Always clean up the pending bid, regardless of outcome
    const cleanup = () => snapshot.ref.remove();

    // Write result so client can show real feedback
    const writeResult = async (status: 'accepted' | 'rejected', reason?: string) => {
      if (bid?.userId) {
        await db.ref(`/bid_results/${bid.userId}/${bidId}`).set({
          status,
          reason: reason || null,
          amount: bid.amount || 0,
          itemId: bid.itemId || null,
          timestamp: SERVER_TIMESTAMP,
        });
      }
    };

    // Validate required bid fields
    if (typeof bid.itemId !== 'string' || typeof bid.auctionId !== 'string' ||
        typeof bid.userId !== 'string' || typeof bid.amount !== 'number' ||
        bid.amount <= 0 || !bid.userDisplayName) {
      console.error(`[processBid] REJECTED bidId=${bidId}: invalid bid data`, JSON.stringify(bid));
      await writeResult('rejected', 'נתוני הצעה לא תקינים');
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
        console.warn(`[processBid] REJECTED bidId=${bidId}: duplicate bid user=${bid.userId} amount=${bid.amount}`);
        await writeResult('rejected', 'הצעה כפולה');
        await cleanup();
        return;
      }
    }

    // Verify user is approved before processing bid
    const userSnap = await db.ref(`/users/${bid.userId}`).once('value');
    const userData = userSnap.val();
    if (!userData || userData.verificationStatus !== 'approved') {
      console.warn(`[processBid] REJECTED bidId=${bidId}: user not approved. status=${userData?.verificationStatus}`);
      await writeResult('rejected', 'המשתמש לא מאושר');
      await cleanup();
      return;
    }

    const itemRef = db.ref(`/auction_items/${bid.itemId}`);
    const auctionRef = db.ref(`/auctions/${bid.auctionId}`);

    // Get auction data for round settings
    const auctionSnap = await auctionRef.once('value');
    const auction = auctionSnap.val();
    if (!auction || auction.status !== 'live') {
      console.warn(`[processBid] REJECTED bidId=${bidId}: auction not live. status=${auction?.status}`);
      await writeResult('rejected', 'המכרז לא פעיל');
      await cleanup();
      return;
    }

    // Allow bids even when timer is paused (per business requirement)

    // Verify user is registered for this auction
    const regSnap = await db.ref(`/registrations/${bid.auctionId}/${bid.userId}`).once('value');
    if (!regSnap.exists()) {
      console.warn(`[processBid] REJECTED bidId=${bidId}: user not registered. auctionId=${bid.auctionId} userId=${bid.userId}`);
      await writeResult('rejected', 'המשתמש לא רשום למכרז');
      await cleanup();
      return;
    }

    const round = auction.currentRound as 1 | 2 | 3;
    const roundKey = `round${round}` as 'round1' | 'round2' | 'round3';
    const roundSettings = auction.settings?.[roundKey] || DEFAULT_SETTINGS[roundKey];
    const increment = roundSettings.increment;
    const timerDuration = getTimerSecondsForBid(auction, roundKey);

    console.log(`[processBid] bidId=${bidId} round=${round} increment=${increment} timerDuration=${timerDuration}`);

    // Transaction to update item — atomic, only one bid wins
    let rejectionReason: string | null = null;
    const result = await itemRef.transaction((item) => {
      if (!item || item.status !== 'active') {
        rejectionReason = `item not active (status=${item?.status || 'null'})`;
        return item;
      }

      const minBid = item.currentBid + increment;

      // Rule: minimum bid = currentBid + increment
      if (bid.amount < minBid) {
        rejectionReason = `amount ${bid.amount} < minBid ${minBid} (currentBid=${item.currentBid} + increment=${increment})`;
        return item;
      }

      // Rule: bid must be aligned to increment
      if ((bid.amount - item.currentBid) % increment !== 0) {
        rejectionReason = `amount not aligned: (${bid.amount} - ${item.currentBid}) % ${increment} = ${(bid.amount - item.currentBid) % increment}`;
        return item;
      }

      // Rule: cannot outbid yourself
      if (bid.userId === item.currentBidderId) {
        rejectionReason = 'self-outbid';
        return item;
      }

      // Accept the bid
      rejectionReason = null;
      item.currentBid = bid.amount;
      item.currentBidderId = bid.userId;
      item.currentBidderName = bid.userDisplayName;
      return item;
    });

    if (result.committed && result.snapshot.val()) {
      const updatedItem = result.snapshot.val();
      // Only update timer if bid was actually accepted (currentBidderId changed)
      if (updatedItem.currentBidderId === bid.userId) {
        console.log(`[processBid] ACCEPTED bidId=${bidId} amount=${bid.amount} user=${bid.userId}`);

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
          timestamp: SERVER_TIMESTAMP,
        });

        // System chat message
        await db.ref(`/live_chat/${bid.auctionId}`).push({
          senderId: 'system',
          senderName: 'מערכת',
          senderRole: 'system',
          message: `הצעה התקבלה: ₪${bid.amount.toLocaleString()} מ-${bid.userDisplayName}`,
          timestamp: SERVER_TIMESTAMP,
        });

        await writeResult('accepted');
      } else {
        console.warn(`[processBid] REJECTED bidId=${bidId} in transaction: ${rejectionReason}`);
        await writeResult('rejected', rejectionReason || 'ההצעה לא התקבלה');
      }
    } else {
      console.warn(`[processBid] REJECTED bidId=${bidId}: transaction not committed`);
      await writeResult('rejected', 'שגיאה בעיבוד ההצעה');
    }

    // Clean up pending bid
    await cleanup();
  });
