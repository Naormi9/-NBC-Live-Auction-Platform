import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.database();

// Helper: verify caller is admin or house_manager
async function verifyAdminRole(context: functions.https.CallableContext): Promise<void> {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }
  const snap = await db.ref(`/users/${context.auth.uid}/role`).once('value');
  const role = snap.val();
  if (role !== 'admin' && role !== 'house_manager') {
    throw new functions.https.HttpsError('permission-denied', 'Admin or house_manager required');
  }
}

// Helper: get live auction (throws if not found or not live)
async function getLiveAuction(auctionId: string): Promise<any> {
  const snap = await db.ref(`/auctions/${auctionId}`).once('value');
  const auction = snap.val();
  if (!auction) throw new functions.https.HttpsError('not-found', 'Auction not found');
  if (auction.status !== 'live') throw new functions.https.HttpsError('failed-precondition', 'Auction is not live');
  return auction;
}

// startAuctionLive
export const startAuctionLive = functions.region('europe-west1').https.onCall(async (data, context) => {
  await verifyAdminRole(context);
  const { auctionId } = data;
  if (!auctionId) throw new functions.https.HttpsError('invalid-argument', 'Missing auctionId');

  const auctionRef = db.ref(`/auctions/${auctionId}`);
  const auctionSnap = await auctionRef.once('value');
  const auction = auctionSnap.val();
  if (!auction) throw new functions.https.HttpsError('not-found', 'Auction not found');

  if (auction.status === 'live') return { action: 'already_live', auctionId };

  if (auction.status !== 'published' && auction.status !== 'draft') {
    throw new functions.https.HttpsError('failed-precondition', `Cannot start auction in status: ${auction.status}`);
  }

  const liveCheck = await db.ref('/auctions').orderByChild('status').equalTo('live').once('value');
  if (liveCheck.exists()) {
    throw new functions.https.HttpsError('failed-precondition', 'Another auction is already live');
  }

  const itemsSnap = await db.ref('/auction_items')
    .orderByChild('auctionId').equalTo(auctionId).once('value');
  if (!itemsSnap.exists()) {
    throw new functions.https.HttpsError('failed-precondition', 'Auction has no items');
  }

  const items = Object.entries(itemsSnap.val())
    .map(([id, d]: [string, any]) => ({ id, ...d }))
    .sort((a: any, b: any) => a.order - b.order);

  const firstItem = items[0] as any;
  const now = Date.now();

  await db.ref(`/auction_items/${firstItem.id}`).update({
    status: 'active',
    currentBid: firstItem.preBidPrice || firstItem.openingPrice,
    currentBidderId: null,
    currentBidderName: null,
  });

  await auctionRef.update({
    status: 'live',
    currentItemId: firstItem.id,
    currentRound: 1,
    timerEndsAt: now + auction.settings.round1.timerSeconds * 1000,
    timerDuration: auction.settings.round1.timerSeconds,
  });

  await db.ref(`/live_chat/${auctionId}`).push({
    senderId: 'system',
    senderName: 'מערכת',
    senderRole: 'system',
    message: `המכרז התחיל! הפריט הראשון: "${firstItem.title}"`,
    timestamp: admin.database.ServerValue.TIMESTAMP,
  });

  return { action: 'started', auctionId, firstItemId: firstItem.id };
});

// activateFirstItem
export const activateFirstItem = functions.region('europe-west1').https.onCall(async (data, context) => {
  await verifyAdminRole(context);
  const { auctionId } = data;
  if (!auctionId) throw new functions.https.HttpsError('invalid-argument', 'Missing auctionId');

  const auction = await getLiveAuction(auctionId);

  const itemsSnap = await db.ref('/auction_items')
    .orderByChild('auctionId').equalTo(auctionId).once('value');
  if (!itemsSnap.exists()) throw new functions.https.HttpsError('not-found', 'No items found');

  const pendingItems = Object.entries(itemsSnap.val())
    .map(([id, d]: [string, any]) => ({ id, ...d }))
    .filter((i: any) => i.status === 'pending')
    .sort((a: any, b: any) => a.order - b.order);

  if (pendingItems.length === 0) {
    throw new functions.https.HttpsError('failed-precondition', 'No pending items');
  }

  const firstItem = pendingItems[0] as any;
  const now = Date.now();

  await db.ref(`/auction_items/${firstItem.id}`).update({
    status: 'active',
    currentBid: firstItem.preBidPrice || firstItem.openingPrice,
  });

  await db.ref(`/auctions/${auctionId}`).update({
    currentItemId: firstItem.id,
    currentRound: 1,
    timerEndsAt: now + auction.settings.round1.timerSeconds * 1000,
    timerDuration: auction.settings.round1.timerSeconds,
  });

  await db.ref(`/live_chat/${auctionId}`).push({
    senderId: 'system',
    senderName: 'מערכת',
    senderRole: 'system',
    message: `הפריט "${firstItem.title}" עלה לבמה!`,
    timestamp: admin.database.ServerValue.TIMESTAMP,
  });

  return { action: 'activated', itemId: firstItem.id };
});

// advanceAuctionRound
export const advanceAuctionRound = functions.region('europe-west1').https.onCall(async (data, context) => {
  await verifyAdminRole(context);
  const { auctionId } = data;
  if (!auctionId) throw new functions.https.HttpsError('invalid-argument', 'Missing auctionId');

  const auction = await getLiveAuction(auctionId);
  if (auction.currentRound >= 3) return { action: 'already_at_round_3' };

  const nextRound = (auction.currentRound + 1) as 2 | 3;
  const roundKey = `round${nextRound}` as 'round2' | 'round3';
  const now = Date.now();

  await db.ref(`/auctions/${auctionId}`).update({
    currentRound: nextRound,
    timerEndsAt: now + auction.settings[roundKey].timerSeconds * 1000,
    timerDuration: auction.settings[roundKey].timerSeconds,
  });

  await db.ref(`/live_chat/${auctionId}`).push({
    senderId: 'system',
    senderName: 'מערכת',
    senderRole: 'system',
    message: `עוברים לסיבוב ${nextRound} — מדרגת קפיצה: ₪${auction.settings[roundKey].increment.toLocaleString()}`,
    timestamp: admin.database.ServerValue.TIMESTAMP,
  });

  return { action: 'advanced_round', round: nextRound };
});

// closeItemAndAdvance
export const closeItemAndAdvance = functions.region('europe-west1').https.onCall(async (data, context) => {
  await verifyAdminRole(context);
  const { auctionId, markAsSold } = data;
  if (!auctionId) throw new functions.https.HttpsError('invalid-argument', 'Missing auctionId');

  const auction = await getLiveAuction(auctionId);
  const currentItemId = auction.currentItemId;
  if (!currentItemId) return { action: 'no_current_item' };

  const itemRef = db.ref(`/auction_items/${currentItemId}`);
  const itemSnap = await itemRef.once('value');
  const item = itemSnap.val();
  if (!item) throw new functions.https.HttpsError('not-found', 'Current item not found');

  if (item.status !== 'sold' && item.status !== 'unsold') {
    const isSold = !!markAsSold && item.currentBid > 0;
    const itemUpdate: Record<string, any> = { status: isSold ? 'sold' : 'unsold' };
    if (isSold) {
      itemUpdate.soldAt = admin.database.ServerValue.TIMESTAMP;
      itemUpdate.soldPrice = item.currentBid;
    }
    await itemRef.update(itemUpdate);

    await db.ref(`/live_chat/${auctionId}`).push({
      senderId: 'system',
      senderName: 'מערכת',
      senderRole: 'system',
      message: isSold
        ? `הפריט "${item.title}" נמכר ב-₪${item.currentBid.toLocaleString()} ל-${item.currentBidderName}!`
        : `הפריט "${item.title}" לא נמכר.`,
      timestamp: admin.database.ServerValue.TIMESTAMP,
    });
  }

  const allItemsSnap = await db.ref('/auction_items')
    .orderByChild('auctionId').equalTo(auctionId).once('value');
  const allItems = allItemsSnap.val() || {};
  const pendingItems = Object.entries(allItems)
    .map(([id, d]: [string, any]) => ({ id, ...d }))
    .filter((i: any) => i.status === 'pending')
    .sort((a: any, b: any) => a.order - b.order);

  const now = Date.now();

  if (pendingItems.length === 0) {
    await db.ref(`/auctions/${auctionId}`).update({ status: 'ended', currentItemId: null });
    await db.ref(`/live_chat/${auctionId}`).push({
      senderId: 'system',
      senderName: 'מערכת',
      senderRole: 'system',
      message: 'המכרז הסתיים! תודה לכל המשתתפים.',
      timestamp: admin.database.ServerValue.TIMESTAMP,
    });
    return { action: 'auction_ended' };
  }

  const nextItem = pendingItems[0] as any;
  await db.ref(`/auction_items/${nextItem.id}`).update({
    status: 'active',
    currentBid: nextItem.preBidPrice || nextItem.openingPrice,
    currentBidderId: null,
    currentBidderName: null,
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

  return { action: 'advanced_to_next', nextItemId: nextItem.id };
});

// adjustAuctionTimer
export const adjustAuctionTimer = functions.region('europe-west1').https.onCall(async (data, context) => {
  await verifyAdminRole(context);
  const { auctionId, action, seconds } = data;
  if (!auctionId) throw new functions.https.HttpsError('invalid-argument', 'Missing auctionId');

  const auction = await getLiveAuction(auctionId);
  const now = Date.now();

  if (action === 'pause') {
    await db.ref(`/auctions/${auctionId}`).update({ timerEndsAt: now + 999999000 });
    return { action: 'paused' };
  }

  if (action === 'add' && typeof seconds === 'number' && seconds > 0) {
    const currentEnd = auction.timerEndsAt || now;
    const newEnd = Math.max(currentEnd, now) + seconds * 1000;
    await db.ref(`/auctions/${auctionId}`).update({ timerEndsAt: newEnd });
    return { action: 'added', seconds };
  }

  throw new functions.https.HttpsError('invalid-argument', 'Invalid action or seconds');
});

// endAuction
export const endAuction = functions.region('europe-west1').https.onCall(async (data, context) => {
  await verifyAdminRole(context);
  const { auctionId } = data;
  if (!auctionId) throw new functions.https.HttpsError('invalid-argument', 'Missing auctionId');

  await getLiveAuction(auctionId);

  await db.ref(`/auctions/${auctionId}`).update({ status: 'ended', currentItemId: null });
  await db.ref(`/live_chat/${auctionId}`).push({
    senderId: 'system',
    senderName: 'מערכת',
    senderRole: 'system',
    message: 'המכרז הסתיים על ידי הכרוז.',
    timestamp: admin.database.ServerValue.TIMESTAMP,
  });

  return { action: 'ended' };
});
