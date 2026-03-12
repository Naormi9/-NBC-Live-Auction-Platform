/**
 * Client-side auction control actions.
 * These write directly to Firebase Realtime Database,
 * bypassing Cloud Functions to avoid CORS issues.
 * Database rules enforce that only admin/house_manager can write.
 */
import { ref, get, update, push, serverTimestamp, query, orderByChild, equalTo } from 'firebase/database';
import { db } from './firebase';

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
  };
}

function chatMsg(auctionId: string, message: string) {
  return push(ref(db, `live_chat/${auctionId}`), {
    senderId: 'system',
    senderName: 'מערכת',
    senderRole: 'system',
    message,
    timestamp: serverTimestamp(),
  });
}

async function getPendingItems(auctionId: string) {
  const itemsQuery = query(ref(db, 'auction_items'), orderByChild('auctionId'), equalTo(auctionId));
  const snap = await get(itemsQuery);
  if (!snap.exists()) return [];
  return Object.entries(snap.val())
    .map(([id, d]: [string, any]) => ({ id, ...d }))
    .filter((i: any) => i.status === 'pending')
    .sort((a: any, b: any) => a.order - b.order);
}

// ─── Start Auction Live ─────────────────────────────────────
export async function startAuctionLive(auctionId: string): Promise<string> {
  // Check auction exists and is startable
  const auctionSnap = await get(ref(db, `auctions/${auctionId}`));
  if (!auctionSnap.exists()) throw new Error('מכרז לא נמצא');
  const auction = auctionSnap.val();

  if (auction.status === 'live') return 'המכרז כבר חי';
  if (auction.status !== 'published' && auction.status !== 'draft') {
    throw new Error(`לא ניתן להפעיל מכרז בסטטוס: ${auction.status}`);
  }

  // Check no other live auction
  const allAuctionsSnap = await get(ref(db, 'auctions'));
  if (allAuctionsSnap.exists()) {
    const all = allAuctionsSnap.val();
    const hasLive = Object.values(all).some((a: any) => a.status === 'live');
    if (hasLive) throw new Error('מכרז אחר כבר חי. לא ניתן להפעיל שני מכרזים במקביל');
  }

  // Get items
  const itemsQuery = query(ref(db, 'auction_items'), orderByChild('auctionId'), equalTo(auctionId));
  const itemsSnap = await get(itemsQuery);
  if (!itemsSnap.exists()) throw new Error('אין פריטים במכרז');

  const items = Object.entries(itemsSnap.val())
    .map(([id, d]: [string, any]) => ({ id, ...d }))
    .sort((a: any, b: any) => a.order - b.order);

  const settings = mergeSettings(auction.settings);
  const firstItem = items[0] as any;
  const now = Date.now();

  // Activate first item
  await update(ref(db, `auction_items/${firstItem.id}`), {
    status: 'active',
    currentBid: firstItem.preBidPrice || firstItem.openingPrice || 0,
    currentBidderId: null,
    currentBidderName: null,
  });

  // Set auction to live
  await update(ref(db, `auctions/${auctionId}`), {
    status: 'live',
    currentItemId: firstItem.id,
    currentRound: 1,
    round1Resets: 0,
    itemStartedAt: now,
    timerEndsAt: now + settings.round1.timerSeconds * 1000,
    timerDuration: settings.round1.timerSeconds,
    settings,
  });

  await chatMsg(auctionId, `המכרז התחיל! הפריט הראשון: "${firstItem.title}"`);
  return 'המכרז עלה לאוויר!';
}

// ─── Activate First/Next Item ───────────────────────────────
export async function activateNextItem(auctionId: string): Promise<string> {
  const pendingItems = await getPendingItems(auctionId);
  if (pendingItems.length === 0) throw new Error('אין פריטים ממתינים');

  const auctionSnap = await get(ref(db, `auctions/${auctionId}`));
  const auction = auctionSnap.val();
  if (!auction || auction.status !== 'live') throw new Error('המכרז לא חי');
  const settings = mergeSettings(auction?.settings);

  const nextItem = pendingItems[0] as any;
  const now = Date.now();

  await update(ref(db, `auction_items/${nextItem.id}`), {
    status: 'active',
    currentBid: nextItem.preBidPrice || nextItem.openingPrice || 0,
    currentBidderId: null,
    currentBidderName: null,
  });

  await update(ref(db, `auctions/${auctionId}`), {
    currentItemId: nextItem.id,
    currentRound: 1,
    round1Resets: 0,
    itemStartedAt: now,
    timerEndsAt: now + settings.round1.timerSeconds * 1000,
    timerDuration: settings.round1.timerSeconds,
  });

  await chatMsg(auctionId, `הפריט "${nextItem.title}" עלה לבמה!`);
  return 'הפריט הופעל';
}

// ─── Advance Round ──────────────────────────────────────────
export async function advanceRound(auctionId: string): Promise<string> {
  const auctionSnap = await get(ref(db, `auctions/${auctionId}`));
  const auction = auctionSnap.val();
  if (!auction || auction.status !== 'live') throw new Error('המכרז לא חי');

  const currentRound = auction.currentRound || 1;
  if (currentRound >= 3) return 'כבר בסיבוב 3';

  const settings = mergeSettings(auction.settings);
  const nextRound = currentRound + 1;
  const roundKey = `round${nextRound}` as 'round2' | 'round3';
  const now = Date.now();

  await update(ref(db, `auctions/${auctionId}`), {
    currentRound: nextRound,
    timerEndsAt: now + settings[roundKey].timerSeconds * 1000,
    timerDuration: settings[roundKey].timerSeconds,
  });

  await chatMsg(auctionId, `עוברים לסיבוב ${nextRound} — מדרגת קפיצה: ₪${settings[roundKey].increment.toLocaleString()}`);
  return `עברנו לסיבוב ${nextRound}`;
}

// ─── Close Item and Advance ─────────────────────────────────
export async function closeItemAndAdvance(auctionId: string, markAsSold: boolean): Promise<string> {
  const auctionSnap = await get(ref(db, `auctions/${auctionId}`));
  const auction = auctionSnap.val();
  if (!auction || auction.status !== 'live') throw new Error('המכרז לא חי');

  const currentItemId = auction.currentItemId;
  if (!currentItemId) throw new Error('אין פריט פעיל');

  const itemSnap = await get(ref(db, `auction_items/${currentItemId}`));
  const item = itemSnap.val();
  if (!item) throw new Error('פריט לא נמצא');

  // Close current item
  if (item.status === 'active') {
    const isSold = markAsSold && item.currentBid > 0 && item.currentBidderId;
    if (isSold) {
      await update(ref(db, `auction_items/${currentItemId}`), {
        status: 'sold',
        soldAt: serverTimestamp(),
        soldPrice: item.currentBid,
      });
      await chatMsg(auctionId, `הפריט "${item.title}" נמכר ב-₪${item.currentBid.toLocaleString()} ל-${item.currentBidderName}!`);
    } else {
      await update(ref(db, `auction_items/${currentItemId}`), { status: 'unsold' });
      await chatMsg(auctionId, `הפריט "${item.title}" לא נמכר.`);
    }
  }

  // Find next pending item
  const pendingItems = await getPendingItems(auctionId);
  const settings = mergeSettings(auction.settings);

  if (pendingItems.length === 0) {
    await update(ref(db, `auctions/${auctionId}`), { status: 'ended', currentItemId: null });
    await chatMsg(auctionId, 'המכרז הסתיים! תודה לכל המשתתפים.');
    return 'המכרז הסתיים';
  }

  const nextItem = pendingItems[0] as any;
  const now = Date.now();

  await update(ref(db, `auction_items/${nextItem.id}`), {
    status: 'active',
    currentBid: nextItem.preBidPrice || nextItem.openingPrice || 0,
    currentBidderId: null,
    currentBidderName: null,
  });

  await update(ref(db, `auctions/${auctionId}`), {
    currentItemId: nextItem.id,
    currentRound: 1,
    round1Resets: 0,
    itemStartedAt: now,
    timerEndsAt: now + settings.round1.timerSeconds * 1000,
    timerDuration: settings.round1.timerSeconds,
  });

  await chatMsg(auctionId, `הפריט "${nextItem.title}" עלה לבמה!`);
  return markAsSold ? 'פריט נמכר — עברנו לבא' : 'פריט לא נמכר — עברנו לבא';
}

// ─── Adjust Timer ───────────────────────────────────────────
export async function pauseTimer(auctionId: string): Promise<string> {
  const auctionSnap = await get(ref(db, `auctions/${auctionId}`));
  const auction = auctionSnap.val();
  if (!auction) throw new Error('מכרז לא נמצא');
  const now = Date.now();
  const remaining = Math.max(0, ((auction?.timerEndsAt || now) - now) / 1000);
  await update(ref(db, `auctions/${auctionId}`), {
    timerPaused: true,
    remainingOnPause: remaining,
  });
  return 'הטיימר הושהה';
}

export async function resumeTimer(auctionId: string): Promise<string> {
  const auctionSnap = await get(ref(db, `auctions/${auctionId}`));
  const auction = auctionSnap.val();
  if (!auction) throw new Error('מכרז לא נמצא');
  const remaining = auction.remainingOnPause || 30;
  const now = Date.now();
  await update(ref(db, `auctions/${auctionId}`), {
    timerPaused: false,
    timerEndsAt: now + remaining * 1000,
  });
  return 'הטיימר חודש';
}

export async function addTime(auctionId: string, seconds: number): Promise<string> {
  const auctionSnap = await get(ref(db, `auctions/${auctionId}`));
  const auction = auctionSnap.val();
  if (!auction) throw new Error('מכרז לא נמצא');
  const now = Date.now();

  if (auction.timerPaused) {
    const remaining = (auction.remainingOnPause || 0) + seconds;
    await update(ref(db, `auctions/${auctionId}`), { remainingOnPause: remaining });
  } else {
    const currentEnd = auction?.timerEndsAt || now;
    const newEnd = Math.max(currentEnd, now) + seconds * 1000;
    await update(ref(db, `auctions/${auctionId}`), { timerEndsAt: newEnd });
  }
  return `נוספו ${seconds} שניות`;
}

// ─── Submit Bid (client-side processing) ────────────────────
export async function submitBid(
  auctionId: string,
  itemId: string,
  userId: string,
  userDisplayName: string,
  amount: number,
  round: 1 | 2 | 3
): Promise<string> {
  const auctionSnap = await get(ref(db, `auctions/${auctionId}`));
  const auction = auctionSnap.val();
  if (!auction || auction.status !== 'live') throw new Error('המכרז לא חי');

  const itemSnap = await get(ref(db, `auction_items/${itemId}`));
  const item = itemSnap.val();
  if (!item || item.status !== 'active') throw new Error('הפריט אינו פעיל');

  const settings = mergeSettings(auction.settings);
  const roundKey = `round${round}` as 'round1' | 'round2' | 'round3';
  const increment = settings[roundKey].increment;
  const timerDuration = settings[roundKey].timerSeconds;

  const minBid = item.currentBid + increment;
  if (amount < minBid) throw new Error(`הצעה מינימלית: ₪${minBid.toLocaleString()}`);
  if ((amount - item.currentBid) % increment !== 0) throw new Error('הסכום לא מיושר למדרגת הקפיצה');
  if (userId === item.currentBidderId) throw new Error('אינך יכול להקפיץ מעל עצמך');

  // Update item with new bid
  const updates: Record<string, any> = {};
  updates[`auction_items/${itemId}/currentBid`] = amount;
  updates[`auction_items/${itemId}/currentBidderId`] = userId;
  updates[`auction_items/${itemId}/currentBidderName`] = userDisplayName;

  // Reset timer on successful bid
  const now = Date.now();
  updates[`auctions/${auctionId}/timerEndsAt`] = now + timerDuration * 1000;
  updates[`auctions/${auctionId}/timerDuration`] = timerDuration;
  updates[`auctions/${auctionId}/timerPaused`] = false;
  updates[`auctions/${auctionId}/round1Resets`] = 0;

  await update(ref(db), updates);

  // Write to bid history
  await push(ref(db, `bid_history/${auctionId}/${itemId}`), {
    userId,
    userDisplayName,
    amount,
    round,
    timestamp: serverTimestamp(),
  });

  // Chat message
  await chatMsg(auctionId, `הצעה התקבלה: ₪${amount.toLocaleString()} מ-${userDisplayName}`);

  return 'ההצעה התקבלה!';
}

// ─── Update Live Settings ───────────────────────────────────
export async function updateLiveSettings(
  auctionId: string,
  roundKey: 'round1' | 'round2' | 'round3',
  increment: number,
  timerSeconds: number
): Promise<string> {
  await update(ref(db, `auctions/${auctionId}/settings/${roundKey}`), {
    increment,
    timerSeconds,
  });
  return `הגדרות ${roundKey === 'round1' ? 'סיבוב 1' : roundKey === 'round2' ? 'סיבוב 2' : 'סיבוב 3'} עודכנו`;
}

// ─── End Auction ────────────────────────────────────────────
export async function endAuction(auctionId: string): Promise<string> {
  await update(ref(db, `auctions/${auctionId}`), { status: 'ended', currentItemId: null });
  await chatMsg(auctionId, 'המכרז הסתיים על ידי הכרוז.');
  return 'המכרז הסתיים';
}

// ─── Auto-Advance Logic (client-side timer expiry handling) ──
// Called when timer reaches 0. Implements the same logic as
// Cloud Function timerTick but runs on the client.
export async function handleTimerExpiry(auctionId: string): Promise<string> {
  const auctionSnap = await get(ref(db, `auctions/${auctionId}`));
  const auction = auctionSnap.val();
  if (!auction || auction.status !== 'live') return '';
  if (auction.timerPaused) return '';

  const settings = mergeSettings(auction.settings);
  const currentRound = auction.currentRound || 1;
  const now = Date.now();

  // Hard close check (30 min default)
  const hardCloseMs = settings.hardCloseMinutes * 60 * 1000;
  const itemStartedAt = auction.itemStartedAt || 0;
  if (itemStartedAt > 0 && (now - itemStartedAt) > hardCloseMs) {
    return closeItemAndAdvance(auctionId, true);
  }

  if (currentRound === 1) {
    const round1Resets = auction.round1Resets || 0;
    if (round1Resets < 2) {
      // Auto-reset timer (attempts 1 and 2)
      await update(ref(db, `auctions/${auctionId}`), {
        round1Resets: round1Resets + 1,
        timerEndsAt: now + settings.round1.timerSeconds * 1000,
      });
      await chatMsg(auctionId, `סיבוב 1 — ניסיון ${round1Resets + 1}/2, אין הצעות`);
      return 'טיימר אופס מחדש';
    } else {
      // 3rd expiry — advance to round 2
      return advanceRound(auctionId);
    }
  } else if (currentRound === 2) {
    // Round 2 expired — advance to round 3
    return advanceRound(auctionId);
  } else {
    // Round 3 expired — close item and advance
    const currentItemId = auction.currentItemId;
    if (!currentItemId) return '';
    const itemSnap = await get(ref(db, `auction_items/${currentItemId}`));
    const item = itemSnap.val();
    const hasBidder = item && item.currentBidderId;
    return closeItemAndAdvance(auctionId, hasBidder);
  }
}
