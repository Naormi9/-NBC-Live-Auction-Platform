import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.database();

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

export const timerTick = functions.region('europe-west1').pubsub
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
      try {
      const auction = auctionData as any;

      if (!auction.timerEndsAt || auction.timerEndsAt > now) continue;
      if (!auction.currentItemId) continue;

      // Hard close check: if item has been active for too long, force close
      const settings = mergeSettings(auction.settings);
      const hardCloseMs = settings.hardCloseMinutes * 60 * 1000;
      const itemStartedAt = auction.itemStartedAt || 0;
      const isHardClose = itemStartedAt > 0 && (now - itemStartedAt) > hardCloseMs;

      // Distributed lock to prevent duplicate processing
      const lockRef = db.ref(`/timer_locks/${auctionId}`);
      const lockResult = await lockRef.transaction((current) => {
        const txNow = Date.now();
        if (current && current > txNow - 50000) return; // lock held within 50s
        return txNow;
      });

      if (!lockResult.committed) continue;

      const currentRound = auction.currentRound as 1 | 2 | 3;

      // Hard close: force close the item regardless of round
      if (isHardClose) {
        await closeItemAndAdvance(auctionId, auction, settings, lockRef);
        continue;
      }

      if (currentRound === 1) {
        // Spec: Round 1 timer resets twice automatically before advancing to round 2
        const round1Resets = auction.round1Resets || 0;
        if (round1Resets < 2) {
          // Auto-reset timer (attempt 1 or 2)
          await db.ref(`/auctions/${auctionId}`).update({
            round1Resets: round1Resets + 1,
            timerEndsAt: now + getTimerSeconds(settings, 'round1') * 1000,
          });
          await db.ref(`/live_chat/${auctionId}`).push({
            senderId: 'system',
            senderName: 'מערכת',
            senderRole: 'system',
            message: `סיבוב 1 — ניסיון ${round1Resets + 1}/2, הטיימר מתאפס`,
            timestamp: admin.database.ServerValue.TIMESTAMP,
          });
        } else {
          // 3rd time expired — advance to round 2
          await advanceRound(auctionId, 2, settings);
        }
      } else if (currentRound === 2) {
        // Spec: Round 2 timer expires — advance to round 3
        await advanceRound(auctionId, 3, settings);
      } else {
        // Round 3 expired — close item and advance to next
        await closeItemAndAdvance(auctionId, auction, settings, lockRef);
      }
      } catch (err) {
        console.error(`Error processing auction ${auctionId}:`, err);
      }
    }
  });

async function advanceRound(auctionId: string, nextRound: 2 | 3, settings: any) {
  const roundKey = `round${nextRound}` as 'round2' | 'round3';
  const timerSeconds = getTimerSeconds(settings, roundKey);
  const now = Date.now();

  await db.ref(`/auctions/${auctionId}`).update({
    currentRound: nextRound,
    timerEndsAt: now + timerSeconds * 1000,
    timerDuration: timerSeconds,
  });

  await db.ref(`/live_chat/${auctionId}`).push({
    senderId: 'system',
    senderName: 'מערכת',
    senderRole: 'system',
    message: `עוברים לסיבוב ${nextRound} — מדרגת קפיצה: ₪${settings[roundKey].increment.toLocaleString()}`,
    timestamp: admin.database.ServerValue.TIMESTAMP,
  });
}

async function closeItemAndAdvance(auctionId: string, auction: any, settings: any, lockRef: admin.database.Reference) {
  const itemRef = db.ref(`/auction_items/${auction.currentItemId}`);
  const itemSnap = await itemRef.once('value');
  const item = itemSnap.val();

  if (!item) return;

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
      message: `הפריט "${item.title}" נמכר ב-₪${item.currentBid.toLocaleString()} ל-${item.currentBidderName}!`,
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

  const now = Date.now();

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
    await lockRef.remove();
  } else {
    const nextItem = pendingItems[0] as any;
    // Credit highest pre-bidder if exists
    let preBidderId: string | null = null;
    let preBidderName: string | null = null;
    if (nextItem.preBidPrice) {
      const preBidsSnap = await db.ref(`/pre_bids/${auctionId}/${nextItem.id}`).once('value');
      if (preBidsSnap.exists()) {
        const bids = preBidsSnap.val();
        let highest: { userId: string; name: string; amount: number } | null = null;
        for (const bid of Object.values(bids) as any[]) {
          if (bid && typeof bid.amount === 'number' && (!highest || bid.amount > highest.amount)) {
            highest = { userId: bid.userId, name: bid.userDisplayName || 'משתתף', amount: bid.amount };
          }
        }
        if (highest) {
          preBidderId = highest.userId;
          preBidderName = highest.name;
        }
      }
    }
    await db.ref(`/auction_items/${nextItem.id}`).update({
      status: 'active',
      currentBid: nextItem.preBidPrice || nextItem.openingPrice || 0,
      currentBidderId: preBidderId,
      currentBidderName: preBidderName,
    });
    const timerSec = getTimerSeconds(settings, 'round1');
    await db.ref(`/auctions/${auctionId}`).update({
      currentItemId: nextItem.id,
      currentRound: 1,
      round1Resets: 0,
      itemStartedAt: now,
      timerEndsAt: now + timerSec * 1000,
      timerDuration: timerSec,
    });
    await db.ref(`/live_chat/${auctionId}`).push({
      senderId: 'system',
      senderName: 'מערכת',
      senderRole: 'system',
      message: `הפריט "${nextItem.title}" עלה לבמה!`,
      timestamp: admin.database.ServerValue.TIMESTAMP,
    });
    await lockRef.remove();
  }
}
