// DEPRECATED — use auctionControl.ts functions instead
// This file is kept for reference only. It is no longer exported from index.ts.
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.database();
const SERVER_TIMESTAMP = admin.database.ServerValue?.TIMESTAMP ?? { '.sv': 'timestamp' };

export const advanceRoundOrItem = functions.region('europe-west1').https.onCall(async (data, context) => {
  // Auth gate — only admin or house_manager may advance
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  }
  const callerSnap = await db.ref(`/users/${context.auth.uid}/role`).once('value');
  const role = callerSnap.val();
  if (role !== 'admin' && role !== 'house_manager') {
    throw new functions.https.HttpsError('permission-denied', 'Admin or house_manager role required');
  }

  const { auctionId } = data;
  if (!auctionId) throw new functions.https.HttpsError('invalid-argument', 'Missing auctionId');

  const auctionRef = db.ref(`/auctions/${auctionId}`);
  const auctionSnap = await auctionRef.once('value');
  const auction = auctionSnap.val();

  if (!auction || auction.status !== 'live') {
    throw new functions.https.HttpsError('failed-precondition', 'Auction not live');
  }

  const currentItemId = auction.currentItemId;
  if (!currentItemId) return { action: 'no_item' };

  const currentRound = auction.currentRound as 1 | 2 | 3;

  if (currentRound < 3) {
    // Advance round
    const nextRound = (currentRound + 1) as 2 | 3;
    const roundKey = `round${nextRound}` as 'round2' | 'round3';
    const timerSeconds = auction.settings[roundKey].timerSeconds;

    await auctionRef.update({
      currentRound: nextRound,
      timerEndsAt: Date.now() + timerSeconds * 1000,
      timerDuration: timerSeconds,
    });

    await db.ref(`/live_chat/${auctionId}`).push({
      senderId: 'system',
      senderName: 'מערכת',
      senderRole: 'system',
      message: `עוברים לסיבוב ${nextRound} — מדרגת קפיצה: ₪${auction.settings[roundKey].increment.toLocaleString()}`,
      timestamp: SERVER_TIMESTAMP,
    });

    return { action: 'advanced_round', round: nextRound };
  }

  // Round 3 is done - close current item
  const itemRef = db.ref(`/auction_items/${currentItemId}`);
  const itemSnap = await itemRef.once('value');
  const item = itemSnap.val();

  const hasBids = item && item.currentBid > item.openingPrice;
  const sold = hasBids || (item && item.currentBidderId);

  if (sold) {
    await itemRef.update({
      status: 'sold',
      soldAt: SERVER_TIMESTAMP,
      soldPrice: item.currentBid,
    });
    await db.ref(`/live_chat/${auctionId}`).push({
      senderId: 'system',
      senderName: 'מערכת',
      senderRole: 'system',
      message: `הפריט "${item.title}" נמכר ב-₪${item.currentBid.toLocaleString()} ל-${item.currentBidderName}!`,
      timestamp: SERVER_TIMESTAMP,
    });
  } else {
    await itemRef.update({ status: 'unsold' });
    await db.ref(`/live_chat/${auctionId}`).push({
      senderId: 'system',
      senderName: 'מערכת',
      senderRole: 'system',
      message: `הפריט "${item.title}" לא נמכר.`,
      timestamp: SERVER_TIMESTAMP,
    });
  }

  // Find next item
  const allItemsSnap = await db.ref('/auction_items')
    .orderByChild('auctionId')
    .equalTo(auctionId)
    .once('value');

  const allItems = allItemsSnap.val();
  if (!allItems) {
    await auctionRef.update({ status: 'ended', currentItemId: null });
    return { action: 'ended' };
  }

  const sortedItems = Object.entries(allItems)
    .map(([id, data]: [string, any]) => ({ id, ...data }))
    .filter((i: any) => i.status === 'pending')
    .sort((a: any, b: any) => a.order - b.order);

  if (sortedItems.length === 0) {
    // No more items
    await auctionRef.update({ status: 'ended', currentItemId: null });
    await db.ref(`/live_chat/${auctionId}`).push({
      senderId: 'system',
      senderName: 'מערכת',
      senderRole: 'system',
      message: 'המכרז הסתיים! תודה לכל המשתתפים.',
      timestamp: SERVER_TIMESTAMP,
    });
    return { action: 'ended' };
  }

  // Activate next item
  const nextItem = sortedItems[0] as any;
  await db.ref(`/auction_items/${nextItem.id}`).update({
    status: 'active',
    currentBid: nextItem.preBidPrice || nextItem.openingPrice,
  });

  await auctionRef.update({
    currentItemId: nextItem.id,
    currentRound: 1,
    timerEndsAt: Date.now() + auction.settings.round1.timerSeconds * 1000,
    timerDuration: auction.settings.round1.timerSeconds,
  });

  await db.ref(`/live_chat/${auctionId}`).push({
    senderId: 'system',
    senderName: 'מערכת',
    senderRole: 'system',
    message: `הפריט "${nextItem.title}" עלה לבמה!`,
    timestamp: SERVER_TIMESTAMP,
  });

  return { action: 'next_item', itemId: nextItem.id };
});
