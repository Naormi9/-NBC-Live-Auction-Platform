import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.database();

// Admin email allowlist - server-side enforcement
const ADMIN_EMAILS = ['ceo@m-motors.co.il', 'office@m-motors.co.il'];

// Default settings fallback
const DEFAULT_SETTINGS = {
  round1: { increment: 1000, timerSeconds: 45 },
  round2: { increment: 500, timerSeconds: 30 },
  round3: { increment: 250, timerSeconds: 30 },
  hardCloseMinutes: 30,
};

function mergeSettings(settings: any) {
  return {
    round1: { ...DEFAULT_SETTINGS.round1, ...(settings?.round1 || {}) },
    round2: { ...DEFAULT_SETTINGS.round2, ...(settings?.round2 || {}) },
    round3: { ...DEFAULT_SETTINGS.round3, ...(settings?.round3 || {}) },
    hardCloseMinutes: settings?.hardCloseMinutes ?? DEFAULT_SETTINGS.hardCloseMinutes,
    timerOverrideSeconds: settings?.timerOverrideSeconds ?? null,
  };
}

function getTimerSeconds(settings: ReturnType<typeof mergeSettings>, roundKey: 'round1' | 'round2' | 'round3'): number {
  if (settings.timerOverrideSeconds && settings.timerOverrideSeconds > 0) {
    return settings.timerOverrideSeconds;
  }
  return settings[roundKey].timerSeconds;
}

async function findHighestPreBidder(auctionId: string, itemId: string): Promise<{ uid: string; name: string } | null> {
  const preBidsSnap = await db.ref(`/pre_bids/${auctionId}/${itemId}`).once('value');
  if (!preBidsSnap.exists()) return null;
  const preBids = preBidsSnap.val();
  let maxAmount = 0;
  let winner: { uid: string; name: string } | null = null;
  for (const [uid, bid] of Object.entries(preBids) as [string, any][]) {
    if (bid.amount > maxAmount) {
      maxAmount = bid.amount;
      winner = { uid, name: bid.userDisplayName || 'משתתף' };
    }
  }
  return winner;
}

// ─── CORS + Auth helpers ────────────────────────────────────
function setCors(res: functions.Response) {
  const allowedOrigin = process.env.CORS_ORIGIN || '*';
  res.set('Access-Control-Allow-Origin', allowedOrigin);
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.set('Access-Control-Max-Age', '3600');
}

function handlePreflight(req: functions.Request, res: functions.Response): boolean {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return true;
  }
  return false;
}

async function verifyAuth(req: functions.Request): Promise<admin.auth.DecodedIdToken> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing or invalid Authorization header');
  }
  const token = authHeader.slice(7).trim();
  return admin.auth().verifyIdToken(token);
}

async function verifyAdminRole(uid: string): Promise<void> {
  // Check role in DB
  const snap = await db.ref(`/users/${uid}/role`).once('value');
  const role = snap.val();
  if (role !== 'admin' && role !== 'house_manager') {
    throw new Error('Admin or house_manager role required');
  }

  // Check email against allowlist (server-side enforcement)
  const userRecord = await admin.auth().getUser(uid);
  const email = userRecord.email?.toLowerCase().trim();
  if (!email || !ADMIN_EMAILS.includes(email)) {
    throw new Error('Email not in admin allowlist');
  }
}

function sendError(res: functions.Response, code: number, message: string) {
  setCors(res);
  res.status(code).json({ error: message });
}

function sendOk(res: functions.Response, data: any) {
  setCors(res);
  res.status(200).json(data);
}

// ─── Shared helpers ─────────────────────────────────────────

async function getLiveAuction(auctionId: string): Promise<any> {
  const snap = await db.ref(`/auctions/${auctionId}`).once('value');
  const auction = snap.val();
  if (!auction) throw new Error('Auction not found');
  if (auction.status !== 'live') throw new Error('Auction is not live');
  auction.settings = mergeSettings(auction.settings);
  return auction;
}

async function advanceToNextItem(auctionId: string, settings: any) {
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
      senderId: 'system', senderName: 'מערכת', senderRole: 'system',
      message: 'המכרז הסתיים! תודה לכל המשתתפים.',
      timestamp: admin.database.ServerValue.TIMESTAMP,
    });
    return { action: 'auction_ended' };
  }

  const nextItem = pendingItems[0] as any;

  // Credit pre-bidder if exists
  const preBidder = await findHighestPreBidder(auctionId, nextItem.id);

  await db.ref(`/auction_items/${nextItem.id}`).update({
    status: 'active',
    currentBid: nextItem.preBidPrice || nextItem.openingPrice || 0,
    currentBidderId: preBidder?.uid || null,
    currentBidderName: preBidder?.name || null,
  });
  const timerSec = getTimerSeconds(settings, 'round1');
  await db.ref(`/auctions/${auctionId}`).update({
    currentItemId: nextItem.id,
    currentRound: 1,
    round1Resets: 0,
    itemStartedAt: now,
    timerEndsAt: now + timerSec * 1000,
    timerDuration: timerSec,
    timerPaused: false,
  });
  await db.ref(`/live_chat/${auctionId}`).push({
    senderId: 'system', senderName: 'מערכת', senderRole: 'system',
    message: `הפריט "${nextItem.title}" עלה לבמה!`,
    timestamp: admin.database.ServerValue.TIMESTAMP,
  });

  return { action: 'advanced_to_next', nextItemId: nextItem.id };
}

// ═══════════════════════════════════════════════════════════════
// CLOUD FUNCTIONS (onRequest with CORS)
// ═══════════════════════════════════════════════════════════════

export const startAuctionLive = functions.region('europe-west1').https.onRequest(async (req, res) => {
  if (handlePreflight(req, res)) return;
  try {
    const decoded = await verifyAuth(req);
    await verifyAdminRole(decoded.uid);

    const { auctionId } = req.body;
    if (!auctionId || typeof auctionId !== 'string') return sendError(res, 400, 'Missing or invalid auctionId');

    const auctionRef = db.ref(`/auctions/${auctionId}`);
    const auctionSnap = await auctionRef.once('value');
    const auction = auctionSnap.val();
    if (!auction) return sendError(res, 404, 'Auction not found');

    if (auction.status === 'live') return sendOk(res, { action: 'already_live', auctionId });

    if (auction.status !== 'published' && auction.status !== 'draft') {
      return sendError(res, 400, `Cannot start auction in status: ${auction.status}`);
    }

    // Check no other live auction
    const liveCheck = await db.ref('/auctions').orderByChild('status').equalTo('live').once('value');
    if (liveCheck.exists()) return sendError(res, 400, 'Another auction is already live');

    const itemsSnap = await db.ref('/auction_items')
      .orderByChild('auctionId').equalTo(auctionId).once('value');
    if (!itemsSnap.exists()) return sendError(res, 400, 'Auction has no items');

    const settings = mergeSettings(auction.settings);
    const items = Object.entries(itemsSnap.val())
      .map(([id, d]: [string, any]) => ({ id, ...d }))
      .sort((a: any, b: any) => a.order - b.order);

    const firstItem = items[0] as any;
    const now = Date.now();

    // Credit pre-bidder if exists
    const preBidder = await findHighestPreBidder(auctionId, firstItem.id);

    await db.ref(`/auction_items/${firstItem.id}`).update({
      status: 'active',
      currentBid: firstItem.preBidPrice || firstItem.openingPrice || 0,
      currentBidderId: preBidder?.uid || null,
      currentBidderName: preBidder?.name || null,
    });

    const timerSec = getTimerSeconds(settings, 'round1');
    await auctionRef.update({
      status: 'live',
      currentItemId: firstItem.id,
      currentRound: 1,
      round1Resets: 0,
      itemStartedAt: now,
      timerEndsAt: now + timerSec * 1000,
      timerDuration: timerSec,
      timerPaused: false,
      settings,
    });

    await db.ref(`/live_chat/${auctionId}`).push({
      senderId: 'system', senderName: 'מערכת', senderRole: 'system',
      message: `המכרז התחיל! הפריט הראשון: "${firstItem.title}"`,
      timestamp: admin.database.ServerValue.TIMESTAMP,
    });

    return sendOk(res, { action: 'started', auctionId, firstItemId: firstItem.id });
  } catch (err: any) {
    return sendError(res, 500, err.message || 'Internal error');
  }
});

export const activateFirstItem = functions.region('europe-west1').https.onRequest(async (req, res) => {
  if (handlePreflight(req, res)) return;
  try {
    const decoded = await verifyAuth(req);
    await verifyAdminRole(decoded.uid);

    const { auctionId } = req.body;
    if (!auctionId || typeof auctionId !== 'string') return sendError(res, 400, 'Missing or invalid auctionId');

    const auction = await getLiveAuction(auctionId);

    const itemsSnap = await db.ref('/auction_items')
      .orderByChild('auctionId').equalTo(auctionId).once('value');
    if (!itemsSnap.exists()) return sendError(res, 404, 'No items found');

    const pendingItems = Object.entries(itemsSnap.val())
      .map(([id, d]: [string, any]) => ({ id, ...d }))
      .filter((i: any) => i.status === 'pending')
      .sort((a: any, b: any) => a.order - b.order);

    if (pendingItems.length === 0) return sendError(res, 400, 'No pending items');

    const firstItem = pendingItems[0] as any;
    const now = Date.now();

    // Credit pre-bidder if exists
    const preBidder = await findHighestPreBidder(auctionId, firstItem.id);

    await db.ref(`/auction_items/${firstItem.id}`).update({
      status: 'active',
      currentBid: firstItem.preBidPrice || firstItem.openingPrice || 0,
      currentBidderId: preBidder?.uid || null,
      currentBidderName: preBidder?.name || null,
    });

    const timerSec = getTimerSeconds(auction.settings, 'round1');
    await db.ref(`/auctions/${auctionId}`).update({
      currentItemId: firstItem.id,
      currentRound: 1,
      round1Resets: 0,
      itemStartedAt: now,
      timerEndsAt: now + timerSec * 1000,
      timerDuration: timerSec,
      timerPaused: false,
    });

    await db.ref(`/live_chat/${auctionId}`).push({
      senderId: 'system', senderName: 'מערכת', senderRole: 'system',
      message: `הפריט "${firstItem.title}" עלה לבמה!`,
      timestamp: admin.database.ServerValue.TIMESTAMP,
    });

    return sendOk(res, { action: 'activated', itemId: firstItem.id });
  } catch (err: any) {
    return sendError(res, 500, err.message || 'Internal error');
  }
});

export const advanceAuctionRound = functions.region('europe-west1').https.onRequest(async (req, res) => {
  if (handlePreflight(req, res)) return;
  try {
    const decoded = await verifyAuth(req);
    await verifyAdminRole(decoded.uid);

    const { auctionId } = req.body;
    if (!auctionId || typeof auctionId !== 'string') return sendError(res, 400, 'Missing or invalid auctionId');

    const auction = await getLiveAuction(auctionId);
    if (auction.currentRound >= 3) return sendOk(res, { action: 'already_at_round_3' });

    const nextRound = (auction.currentRound + 1) as 2 | 3;
    const roundKey = `round${nextRound}` as 'round2' | 'round3';
    const now = Date.now();
    const timerSec = getTimerSeconds(auction.settings, roundKey);

    await db.ref(`/auctions/${auctionId}`).update({
      currentRound: nextRound,
      timerEndsAt: now + timerSec * 1000,
      timerDuration: timerSec,
      timerPaused: false,
    });

    await db.ref(`/live_chat/${auctionId}`).push({
      senderId: 'system', senderName: 'מערכת', senderRole: 'system',
      message: `עוברים לסיבוב ${nextRound} — מדרגת קפיצה: ₪${auction.settings[roundKey].increment.toLocaleString()}`,
      timestamp: admin.database.ServerValue.TIMESTAMP,
    });

    return sendOk(res, { action: 'advanced_round', round: nextRound });
  } catch (err: any) {
    return sendError(res, 500, err.message || 'Internal error');
  }
});

export const closeItemAndAdvance = functions.region('europe-west1').https.onRequest(async (req, res) => {
  if (handlePreflight(req, res)) return;
  try {
    const decoded = await verifyAuth(req);
    await verifyAdminRole(decoded.uid);

    const { auctionId, markAsSold } = req.body;
    if (!auctionId) return sendError(res, 400, 'Missing auctionId');

    const auction = await getLiveAuction(auctionId);
    const currentItemId = auction.currentItemId;
    if (!currentItemId) return sendOk(res, { action: 'no_current_item' });

    const itemRef = db.ref(`/auction_items/${currentItemId}`);
    const itemSnap = await itemRef.once('value');
    const item = itemSnap.val();
    if (!item) return sendError(res, 404, 'Current item not found');

    if (item.status !== 'sold' && item.status !== 'unsold') {
      const hasBidder = !!item.currentBidderId;
      const isSold = !!markAsSold && item.currentBid > 0 && hasBidder;
      const itemUpdate: Record<string, any> = { status: isSold ? 'sold' : 'unsold' };
      if (isSold) {
        itemUpdate.soldAt = admin.database.ServerValue.TIMESTAMP;
        itemUpdate.soldPrice = item.currentBid;
        itemUpdate.winnerId = item.currentBidderId;
        itemUpdate.winnerName = item.currentBidderName;
        itemUpdate.winnerPaymentStatus = 'pending';
      }
      await itemRef.update(itemUpdate);

      await db.ref(`/live_chat/${auctionId}`).push({
        senderId: 'system', senderName: 'מערכת', senderRole: 'system',
        message: isSold
          ? `הפריט "${item.title}" נמכר ב-₪${item.currentBid.toLocaleString()} ל-${item.currentBidderName}!`
          : `הפריט "${item.title}" לא נמכר.`,
        timestamp: admin.database.ServerValue.TIMESTAMP,
      });
    }

    const result = await advanceToNextItem(auctionId, auction.settings);
    return sendOk(res, result);
  } catch (err: any) {
    return sendError(res, 500, err.message || 'Internal error');
  }
});

export const adjustAuctionTimer = functions.region('europe-west1').https.onRequest(async (req, res) => {
  if (handlePreflight(req, res)) return;
  try {
    const decoded = await verifyAuth(req);
    await verifyAdminRole(decoded.uid);

    const { auctionId, action, seconds } = req.body;
    if (!auctionId) return sendError(res, 400, 'Missing auctionId');

    const auction = await getLiveAuction(auctionId);
    const now = Date.now();

    if (action === 'pause') {
      const remaining = Math.max(0, ((auction.timerEndsAt || now) - now) / 1000);
      await db.ref(`/auctions/${auctionId}`).update({
        timerPaused: true,
        remainingOnPause: remaining,
      });
      return sendOk(res, { action: 'paused' });
    }

    if (action === 'resume') {
      const remaining = auction.remainingOnPause || 30;
      await db.ref(`/auctions/${auctionId}`).update({
        timerPaused: false,
        timerEndsAt: now + remaining * 1000,
      });
      return sendOk(res, { action: 'resumed' });
    }

    if (action === 'add' && typeof seconds === 'number' && seconds > 0 && seconds <= 3600) {
      if (auction.timerPaused) {
        const remaining = (auction.remainingOnPause || 0) + seconds;
        await db.ref(`/auctions/${auctionId}`).update({ remainingOnPause: remaining });
      } else {
        const currentEnd = auction.timerEndsAt || now;
        const newEnd = Math.max(currentEnd, now) + seconds * 1000;
        await db.ref(`/auctions/${auctionId}`).update({ timerEndsAt: newEnd });
      }
      return sendOk(res, { action: 'added', seconds });
    }

    return sendError(res, 400, 'Invalid action or seconds');
  } catch (err: any) {
    return sendError(res, 500, err.message || 'Internal error');
  }
});

export const endAuction = functions.region('europe-west1').https.onRequest(async (req, res) => {
  if (handlePreflight(req, res)) return;
  try {
    const decoded = await verifyAuth(req);
    await verifyAdminRole(decoded.uid);

    const { auctionId } = req.body;
    if (!auctionId || typeof auctionId !== 'string') return sendError(res, 400, 'Missing or invalid auctionId');

    await getLiveAuction(auctionId);

    await db.ref(`/auctions/${auctionId}`).update({ status: 'ended', currentItemId: null });
    await db.ref(`/live_chat/${auctionId}`).push({
      senderId: 'system', senderName: 'מערכת', senderRole: 'system',
      message: 'המכרז הסתיים על ידי הכרוז.',
      timestamp: admin.database.ServerValue.TIMESTAMP,
    });

    return sendOk(res, { action: 'ended' });
  } catch (err: any) {
    return sendError(res, 500, err.message || 'Internal error');
  }
});
