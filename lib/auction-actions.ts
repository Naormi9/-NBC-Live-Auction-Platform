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
    timerOverrideSeconds: settings?.timerOverrideSeconds ?? null,
  };
}

/** Get effective timer seconds — override takes precedence over per-round setting */
function getTimerSeconds(settings: ReturnType<typeof mergeSettings>, roundKey: 'round1' | 'round2' | 'round3'): number {
  if (settings.timerOverrideSeconds && settings.timerOverrideSeconds > 0) {
    return settings.timerOverrideSeconds;
  }
  return settings[roundKey].timerSeconds;
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

/** Find the highest pre-bidder for an item to credit them when going live */
async function getHighestPreBidder(auctionId: string, itemId: string): Promise<{ userId: string; displayName: string; amount: number } | null> {
  const preBidsSnap = await get(ref(db, `pre_bids/${auctionId}/${itemId}`));
  if (!preBidsSnap.exists()) return null;
  const bids = preBidsSnap.val();
  let highest: { userId: string; displayName: string; amount: number } | null = null;
  for (const [, bid] of Object.entries(bids) as [string, any][]) {
    if (bid && typeof bid.amount === 'number' && (!highest || bid.amount > highest.amount)) {
      highest = { userId: bid.userId, displayName: bid.userDisplayName || 'משתתף', amount: bid.amount };
    }
  }
  return highest;
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

  // Activate first item — credit highest pre-bidder if exists
  const preBidder = firstItem.preBidPrice ? await getHighestPreBidder(auctionId, firstItem.id) : null;
  await update(ref(db, `auction_items/${firstItem.id}`), {
    status: 'active',
    currentBid: firstItem.preBidPrice || firstItem.openingPrice || 0,
    currentBidderId: preBidder?.userId || null,
    currentBidderName: preBidder?.displayName || null,
  });

  // Set auction to live
  await update(ref(db, `auctions/${auctionId}`), {
    status: 'live',
    currentItemId: firstItem.id,
    currentRound: 1,
    round1Resets: 0,
    itemStartedAt: now,
    timerEndsAt: now + getTimerSeconds(settings, 'round1') * 1000,
    timerDuration: getTimerSeconds(settings, 'round1'),
    timerPaused: false,
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

  // Credit highest pre-bidder if exists
  const preBidder = nextItem.preBidPrice ? await getHighestPreBidder(auctionId, nextItem.id) : null;
  await update(ref(db, `auction_items/${nextItem.id}`), {
    status: 'active',
    currentBid: nextItem.preBidPrice || nextItem.openingPrice || 0,
    currentBidderId: preBidder?.userId || null,
    currentBidderName: preBidder?.displayName || null,
  });

  await update(ref(db, `auctions/${auctionId}`), {
    currentItemId: nextItem.id,
    currentRound: 1,
    round1Resets: 0,
    itemStartedAt: now,
    timerEndsAt: now + getTimerSeconds(settings, 'round1') * 1000,
    timerDuration: getTimerSeconds(settings, 'round1'),
    timerPaused: false,
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

  const timerSec = getTimerSeconds(settings, roundKey);
  await update(ref(db, `auctions/${auctionId}`), {
    currentRound: nextRound,
    timerEndsAt: now + timerSec * 1000,
    timerDuration: timerSec,
    timerPaused: false,
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
    const hasBidder = !!item.currentBidderId;
    const isSold = markAsSold && item.currentBid > 0 && hasBidder;
    if (isSold) {
      await update(ref(db, `auction_items/${currentItemId}`), {
        status: 'sold',
        soldAt: serverTimestamp(),
        soldPrice: item.currentBid,
        winnerId: item.currentBidderId,
        winnerName: item.currentBidderName,
        winnerPaymentStatus: 'pending',
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

  // Credit highest pre-bidder if exists
  const nextPreBidder = nextItem.preBidPrice ? await getHighestPreBidder(auctionId, nextItem.id) : null;
  await update(ref(db, `auction_items/${nextItem.id}`), {
    status: 'active',
    currentBid: nextItem.preBidPrice || nextItem.openingPrice || 0,
    currentBidderId: nextPreBidder?.userId || null,
    currentBidderName: nextPreBidder?.displayName || null,
  });

  const timerSec = getTimerSeconds(settings, 'round1');
  await update(ref(db, `auctions/${auctionId}`), {
    currentItemId: nextItem.id,
    currentRound: 1,
    round1Resets: 0,
    itemStartedAt: now,
    timerEndsAt: now + timerSec * 1000,
    timerDuration: timerSec,
    timerPaused: false,
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

// ─── Submit Bid (via pending_bids for Cloud Function processing) ──
// Writes to /pending_bids which participants CAN write to per RTDB rules.
// The processBid Cloud Function validates and applies the bid atomically.
export async function submitBid(
  auctionId: string,
  itemId: string,
  userId: string,
  userDisplayName: string,
  amount: number,
  round: 1 | 2 | 3
): Promise<string> {
  // Client-side pre-validation (CF does authoritative check)
  const auctionSnap = await get(ref(db, `auctions/${auctionId}`));
  const auction = auctionSnap.val();
  if (!auction || auction.status !== 'live') throw new Error('המכרז לא חי');

  const itemSnap = await get(ref(db, `auction_items/${itemId}`));
  const item = itemSnap.val();
  if (!item || item.status !== 'active') throw new Error('הפריט אינו פעיל');

  const settings = mergeSettings(auction.settings);
  const roundKey = `round${round}` as 'round1' | 'round2' | 'round3';
  const increment = settings[roundKey].increment;

  const minBid = item.currentBid + increment;
  if (amount < minBid) throw new Error(`הצעה מינימלית: ₪${minBid.toLocaleString()}`);
  if ((amount - item.currentBid) % increment !== 0) throw new Error('הסכום לא מיושר למדרגת הקפיצה');
  if (userId === item.currentBidderId) throw new Error('אינך יכול להקפיץ מעל עצמך');

  // Write to pending_bids — Cloud Function processBid handles the rest
  await push(ref(db, 'pending_bids'), {
    auctionId,
    itemId,
    userId,
    userDisplayName,
    amount,
    round,
    timestamp: serverTimestamp(),
  });

  return 'ההצעה נשלחה!';
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

// ─── Set Fixed Timer Override ───────────────────────────────
export async function setTimerOverride(
  auctionId: string,
  seconds: number | null
): Promise<string> {
  await update(ref(db, `auctions/${auctionId}/settings`), {
    timerOverrideSeconds: seconds,
  });
  if (seconds) {
    return `טיימר קבוע הוגדר: ${seconds} שניות`;
  }
  return 'טיימר קבוע בוטל — חזרה להגדרות סיבובים';
}

// ─── End Auction ────────────────────────────────────────────
export async function endAuction(auctionId: string): Promise<string> {
  await update(ref(db, `auctions/${auctionId}`), { status: 'ended', currentItemId: null });
  await chatMsg(auctionId, 'המכרז הסתיים על ידי הכרוז.');
  return 'המכרז הסתיים';
}

// ─── Delete Auction ─────────────────────────────────────────
export async function deleteAuction(auctionId: string): Promise<string> {
  const auctionSnap = await get(ref(db, `auctions/${auctionId}`));
  if (!auctionSnap.exists()) throw new Error('מכרז לא נמצא');
  const auction = auctionSnap.val();
  if (auction.status === 'live') throw new Error('לא ניתן למחוק מכרז חי');

  // Find all items belonging to this auction
  const itemsQuery = query(ref(db, 'auction_items'), orderByChild('auctionId'), equalTo(auctionId));
  const itemsSnap = await get(itemsQuery);
  const itemIds = itemsSnap.exists() ? Object.keys(itemsSnap.val()) : [];

  // Build multi-path delete
  const updates: Record<string, null> = {
    [`auctions/${auctionId}`]: null,
    [`bid_history/${auctionId}`]: null,
    [`pre_bids/${auctionId}`]: null,
    [`live_chat/${auctionId}`]: null,
    [`registrations/${auctionId}`]: null,
    [`timer_locks/${auctionId}`]: null,
    [`presence/${auctionId}`]: null,
  };

  // Delete each item
  for (const itemId of itemIds) {
    updates[`auction_items/${itemId}`] = null;
  }

  await update(ref(db), updates);
  return 'המכרז נמחק בהצלחה';
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
    // Hard close: only mark as sold if there's an actual bidder
    const currentItemId = auction.currentItemId;
    if (currentItemId) {
      const hcItemSnap = await get(ref(db, `auction_items/${currentItemId}`));
      const hcItem = hcItemSnap.val();
      const hasBidder = hcItem && !!hcItem.currentBidderId;
      return closeItemAndAdvance(auctionId, hasBidder);
    }
    return closeItemAndAdvance(auctionId, false);
  }

  if (currentRound === 1) {
    const round1Resets = auction.round1Resets || 0;
    if (round1Resets < 2) {
      // Auto-reset timer (attempts 1 and 2)
      const timerSec = getTimerSeconds(settings, 'round1');
      await update(ref(db, `auctions/${auctionId}`), {
        round1Resets: round1Resets + 1,
        timerEndsAt: now + timerSec * 1000,
        timerPaused: false,
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
