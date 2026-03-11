import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.database();

// Runs every 1 minute to check live auctions for expired timers
// Firebase Cloud Scheduler minimum is 1 minute
// Client-side auto-advance in AuctioneerConsole fills the gap with 5s checks
export const timerTick = functions.pubsub
  .schedule('every 1 minutes')
  .onRun(async () => {
    const auctionsSnap = await db.ref('/auctions')
      .orderByChild('status')
      .equalTo('live')
      .once('value');

    if (!auctionsSnap.exists()) return;

    const auctions = auctionsSnap.val();
    const now = Date.now();

    for (const [auctionId, auctionData] of Object.entries(auctions)) {
      const auction = auctionData as any;

      if (!auction.timerEndsAt || auction.timerEndsAt > now) continue;
      if (!auction.currentItemId) continue;

      // Timer has expired
      const currentRound = auction.currentRound as 1 | 2 | 3;

      if (currentRound < 3) {
        // Advance to next round
        const nextRound = (currentRound + 1) as 2 | 3;
        const roundKey = `round${nextRound}` as 'round2' | 'round3';
        const timerSeconds = auction.settings[roundKey].timerSeconds;

        await db.ref(`/auctions/${auctionId}`).update({
          currentRound: nextRound,
          timerEndsAt: now + timerSeconds * 1000,
          timerDuration: timerSeconds,
        });

        await db.ref(`/live_chat/${auctionId}`).push({
          senderId: 'system',
          senderName: 'מערכת',
          senderRole: 'system',
          message: `עוברים לסיבוב ${nextRound}`,
          timestamp: admin.database.ServerValue.TIMESTAMP,
        });
      } else {
        // Round 3 timer expired - close item and advance
        const itemRef = db.ref(`/auction_items/${auction.currentItemId}`);
        const itemSnap = await itemRef.once('value');
        const item = itemSnap.val();

        if (!item) continue;

        const hasBidder = item.currentBidderId != null;

        if (hasBidder) {
          await itemRef.update({
            status: 'sold',
            soldAt: admin.database.ServerValue.TIMESTAMP,
            soldPrice: item.currentBid,
          });
          await db.ref(`/live_chat/${auctionId}`).push({
            senderId: 'system',
            senderName: 'מערכת',
            senderRole: 'system',
            message: `הפריט "${item.title}" נמכר ב-₪${item.currentBid.toLocaleString()}!`,
            timestamp: admin.database.ServerValue.TIMESTAMP,
          });
        } else {
          await itemRef.update({ status: 'unsold' });
          await db.ref(`/live_chat/${auctionId}`).push({
            senderId: 'system',
            senderName: 'מערכת',
            senderRole: 'system',
            message: `הפריט "${item.title}" לא נמכר.`,
            timestamp: admin.database.ServerValue.TIMESTAMP,
          });
        }

        // Find next pending item
        const allItemsSnap = await db.ref('/auction_items')
          .orderByChild('auctionId')
          .equalTo(auctionId)
          .once('value');

        const allItems = allItemsSnap.val() || {};
        const pendingItems = Object.entries(allItems)
          .map(([id, data]: [string, any]) => ({ id, ...data }))
          .filter((i: any) => i.status === 'pending')
          .sort((a: any, b: any) => a.order - b.order);

        if (pendingItems.length === 0) {
          await db.ref(`/auctions/${auctionId}`).update({
            status: 'ended',
            currentItemId: null,
          });
          await db.ref(`/live_chat/${auctionId}`).push({
            senderId: 'system',
            senderName: 'מערכת',
            senderRole: 'system',
            message: 'המכרז הסתיים! תודה לכל המשתתפים.',
            timestamp: admin.database.ServerValue.TIMESTAMP,
          });
        } else {
          const nextItem = pendingItems[0] as any;
          await db.ref(`/auction_items/${nextItem.id}`).update({
            status: 'active',
            currentBid: nextItem.preBidPrice || nextItem.openingPrice,
          });
          await db.ref(`/auctions/${auctionId}`).update({
            currentItemId: nextItem.id,
            currentRound: 1,
            timerEndsAt: now + auction.settings.round1.timerSeconds * 1000,
            timerDuration: auction.settings.round1.timerSeconds,
          });
          await db.ref(`/live_chat/${auctionId}`).push({
            senderId: 'system',
            senderName: 'מערכת',
            senderRole: 'system',
            message: `הפריט "${nextItem.title}" עלה לבמה!`,
            timestamp: admin.database.ServerValue.TIMESTAMP,
          });
        }
      }
    }
  });
