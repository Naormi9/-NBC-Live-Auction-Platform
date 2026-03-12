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
  const now = Date.now();
  await update(ref(db, `auctions/${auctionId}`), { timerEndsAt: now + 999999000 });
  return 'הטיימר הושהה';
}

export async function addTime(auctionId: string, seconds: number): Promise<string> {
  const auctionSnap = await get(ref(db, `auctions/${auctionId}`));
  const auction = auctionSnap.val();
  const now = Date.now();
  const currentEnd = auction?.timerEndsAt || now;
  const newEnd = Math.max(currentEnd, now) + seconds * 1000;
  await update(ref(db, `auctions/${auctionId}`), { timerEndsAt: newEnd });
  return `נוספו ${seconds} שניות`;
}

// ─── End Auction ────────────────────────────────────────────
export async function endAuction(auctionId: string): Promise<string> {
  await update(ref(db, `auctions/${auctionId}`), { status: 'ended', currentItemId: null });
  await chatMsg(auctionId, 'המכרז הסתיים על ידי הכרוז.');
  return 'המכרז הסתיים';
}
