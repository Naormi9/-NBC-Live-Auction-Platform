import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.database();

export const processBid = functions.database
  .ref('/pending_bids/{bidId}')
  .onCreate(async (snapshot, context) => {
    const bid = snapshot.val();
    if (!bid) return;

    const itemRef = db.ref(`/auction_items/${bid.itemId}`);
    const auctionRef = db.ref(`/auctions/${bid.auctionId}`);

    // Get auction data for round settings
    const auctionSnap = await auctionRef.once('value');
    const auction = auctionSnap.val();
    if (!auction || auction.status !== 'live') {
      await snapshot.ref.remove();
      return;
    }

    const round = auction.currentRound as 1 | 2 | 3;
    const roundKey = `round${round}` as 'round1' | 'round2' | 'round3';
    const increment = auction.settings[roundKey].increment;
    const timerDuration = auction.settings[roundKey].timerSeconds;

    // Transaction to update item
    const result = await itemRef.transaction((item) => {
      if (!item || item.status !== 'active') return item;

      // Rule: minimum bid = currentBid + increment
      if (bid.amount < item.currentBid + increment) return item;

      // Rule: cannot outbid yourself
      if (bid.userId === item.currentBidderId) return item;

      // Accept the bid
      item.currentBid = bid.amount;
      item.currentBidderId = bid.userId;
      item.currentBidderName = bid.userDisplayName;
      return item;
    });

    if (result.committed) {
      // Reset timer on successful bid
      await auctionRef.update({
        timerEndsAt: Date.now() + timerDuration * 1000,
        timerDuration: timerDuration,
      });

      // Write to bid_history
      await db.ref(`/bid_history/${bid.auctionId}/${bid.itemId}`).push({
        userId: bid.userId,
        userDisplayName: bid.userDisplayName,
        amount: bid.amount,
        round: bid.round,
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

    // Clean up pending bid
    await snapshot.ref.remove();
  });
