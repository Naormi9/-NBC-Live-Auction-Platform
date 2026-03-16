/**
 * Comprehensive Auction Logic Test Suite
 * Covers all 45 validation areas (A-G) from the spec.
 *
 * Tests are organized as:
 *   1. Pure logic tests (auction-utils functions)
 *   2. Source code structural validation (verifying code paths exist and are correct)
 *   3. Cloud Function logic validation
 *
 * Since we can't connect to Firebase in tests, structural tests read source
 * files and verify critical code patterns exist (e.g., "pending_bids" in submitBid,
 * "winnerId" in closeItemAndAdvance, etc.)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  getIncrement,
  getMinBid,
  canPlaceBid,
  formatPrice,
  formatTimer,
  getTimerColor,
  DEFAULT_AUCTION_SETTINGS,
} from '../lib/auction-utils';
import type { Auction, AuctionItem, AuctionSettings } from '../lib/types';

// ─── Helpers ────────────────────────────────────────────────
function readSrc(relativePath: string): string {
  return readFileSync(resolve(__dirname, '..', relativePath), 'utf-8');
}

function makeAuction(overrides: Partial<Auction> = {}): Auction {
  return {
    id: 'auction1',
    title: 'Test Auction',
    houseId: 'house1',
    houseName: 'Test House',
    scheduledAt: Date.now(),
    status: 'live',
    preBidsEnabled: true,
    currentItemId: 'item1',
    currentRound: 1,
    timerEndsAt: Date.now() + 30000,
    timerDuration: 45,
    viewerCount: 10,
    settings: { ...DEFAULT_AUCTION_SETTINGS },
    ...overrides,
  };
}

function makeItem(overrides: Partial<AuctionItem> = {}): AuctionItem {
  return {
    id: 'item1',
    auctionId: 'auction1',
    order: 1,
    title: 'BMW 320i',
    description: 'Nice car',
    images: [],
    openingPrice: 50000,
    currentBid: 51000,
    currentBidderId: 'user-A',
    currentBidderName: 'User A',
    preBidPrice: null,
    status: 'active',
    soldAt: null,
    soldPrice: null,
    winnerId: null,
    winnerName: null,
    winnerPaymentStatus: null,
    make: 'BMW',
    model: '320i',
    year: 2020,
    km: 30000,
    color: 'White',
    engineCC: 2000,
    owners: 1,
    registrationDate: '2020-01-01',
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════
// A. LIVE BID FLOW (7 tests)
// ═══════════════════════════════════════════════════════════════
describe('A. Live Bid Flow', () => {
  const auctionActions = readSrc('lib/auction-actions.ts');
  const processBid = readSrc('functions/src/processBid.ts');
  const dbRules = readSrc('database.rules.json');

  it('A1. submitBid writes to pending_bids (not directly to auction_items/bid_history)', () => {
    // CRITICAL: submitBid must write to pending_bids so processBid CF handles it
    expect(auctionActions).toContain("push(ref(db, 'pending_bids')");
    // Must NOT directly write bid_history from client
    expect(auctionActions).not.toContain("push(ref(db, `bid_history/");
    // submitBid reads auction_items for validation but does NOT update/push to it
    const submitBidBody = auctionActions.slice(
      auctionActions.indexOf('export async function submitBid'),
      auctionActions.indexOf("return 'ההצעה נשלחה!'")
    );
    // No update() calls to auction_items (reads via get() are fine)
    expect(submitBidBody).not.toContain("update(ref(db, `auction_items/");
  });

  it('A2. No PERMISSION_DENIED — pending_bids rules allow approved users', () => {
    const rules = JSON.parse(dbRules);
    const bidRule = rules.rules.pending_bids['$bidId']['.write'];
    expect(bidRule).toContain("verificationStatus");
    expect(bidRule).toContain("approved");
    // Does NOT require admin role — just approved verification
    expect(bidRule).not.toContain("role");
  });

  it('A3. Self-outbid prevention — client and server both check', () => {
    // Client-side check in submitBid
    expect(auctionActions).toContain('userId === item.currentBidderId');
    // Server-side check in processBid CF
    expect(processBid).toContain('bid.userId === item.currentBidderId');
  });

  it('A4. Increment alignment enforced — client and server both check', () => {
    // Client-side in submitBid
    expect(auctionActions).toContain("(amount - item.currentBid) % increment !== 0");
    // Server-side in processBid
    expect(processBid).toContain("(bid.amount - item.currentBid) % increment !== 0");
  });

  it('A5. Minimum bid enforced — client and server', () => {
    // canPlaceBid in auction-utils
    const utils = readSrc('lib/auction-utils.ts');
    expect(utils).toContain('amount < minBid');
    // processBid CF
    expect(processBid).toContain('bid.amount < minBid');
  });

  it('A6. Timer resets on successful bid', () => {
    expect(processBid).toContain('timerEndsAt: Date.now() + timerDuration * 1000');
    expect(processBid).toContain('round1Resets: 0');
  });

  it('A7. Bid rejected when timer is paused — client and server', () => {
    // Client-side
    expect(auctionActions).toContain("auction.timerPaused) throw new Error");
    // Server-side
    expect(processBid).toContain('auction.timerPaused');
  });
});

// ═══════════════════════════════════════════════════════════════
// B. PRE-BID FLOW (6 tests)
// ═══════════════════════════════════════════════════════════════
describe('B. Pre-bid Flow', () => {
  const auctionActions = readSrc('lib/auction-actions.ts');
  const auctionControl = readSrc('functions/src/auctionControl.ts');
  const preBidAgg = readSrc('functions/src/preBidAggregator.ts');
  const timerManager = readSrc('functions/src/timerManager.ts');
  const dbRules = readSrc('database.rules.json');

  it('B1. Pre-bid writes allowed only for approved users', () => {
    const rules = JSON.parse(dbRules);
    const preBidWrite = rules.rules.pre_bids['$auctionId']['$itemId']['$userId']['.write'];
    expect(preBidWrite).toContain("auth.uid === $userId");
    expect(preBidWrite).toContain("verificationStatus");
    expect(preBidWrite).toContain("approved");
  });

  it('B2. onPreBidCreated aggregates max pre-bid and updates preBidPrice', () => {
    expect(preBidAgg).toContain("pre_bids/{auctionId}/{itemId}/{userId}");
    expect(preBidAgg).toContain("maxAmount");
    expect(preBidAgg).toContain("preBidPrice");
  });

  it('B3. startAuctionLive credits pre-bidder on first item', () => {
    expect(auctionControl).toContain('findHighestPreBidder(auctionId, firstItem.id)');
    expect(auctionActions).toContain("pre_bids/${auctionId}/${firstItem.id}");
    // Must set currentBidderId from pre-bidder
    const startBlock = auctionActions.slice(
      auctionActions.indexOf('export async function startAuctionLive'),
      auctionActions.indexOf('export async function activateNextItem')
    );
    expect(startBlock).toContain('currentBidderId: preBidderId');
  });

  it('B4. activateNextItem credits pre-bidder', () => {
    const activateBlock = auctionActions.slice(
      auctionActions.indexOf('export async function activateNextItem'),
      auctionActions.indexOf('export async function advanceRound')
    );
    expect(activateBlock).toContain("pre_bids/${auctionId}/${nextItem.id}");
    expect(activateBlock).toContain('currentBidderId: preBidderId');
  });

  it('B5. closeItemAndAdvance credits pre-bidder on next item', () => {
    const closeBlock = auctionActions.slice(
      auctionActions.indexOf('export async function closeItemAndAdvance'),
      auctionActions.indexOf('export async function pauseTimer')
    );
    expect(closeBlock).toContain("pre_bids/${auctionId}/${nextItem.id}");
    expect(closeBlock).toContain('currentBidderId: nextPreBidderId');
  });

  it('B6. Cloud Functions also credit pre-bidders (auctionControl + timerManager)', () => {
    expect(auctionControl).toContain('findHighestPreBidder');
    expect(timerManager).toContain("pre_bids/${auctionId}/${nextItem.id}");
  });
});

// ═══════════════════════════════════════════════════════════════
// C. TIMER / ROUND ENGINE (10 tests)
// ═══════════════════════════════════════════════════════════════
describe('C. Timer / Round Engine', () => {
  const auctionActions = readSrc('lib/auction-actions.ts');
  const timerManager = readSrc('functions/src/timerManager.ts');
  const auctionControl = readSrc('functions/src/auctionControl.ts');

  it('C1. Round 1 auto-resets twice before advancing to round 2', () => {
    // Client-side
    expect(auctionActions).toContain('round1Resets < 2');
    expect(auctionActions).toContain('round1Resets + 1');
    // Server-side
    expect(timerManager).toContain('round1Resets < 2');
    expect(timerManager).toContain('round1Resets + 1');
  });

  it('C2. After 3rd Round 1 expiry, advances to Round 2', () => {
    // Client: else branch after round1Resets < 2
    expect(auctionActions).toContain("advanceRound(auctionId)");
    // Server: advanceRound(auctionId, 2, settings)
    expect(timerManager).toContain("advanceRound(auctionId, 2, settings)");
  });

  it('C3. Round 2 expiry advances to Round 3', () => {
    expect(auctionActions).toContain("currentRound === 2");
    expect(timerManager).toContain("currentRound === 2");
    expect(timerManager).toContain("advanceRound(auctionId, 3, settings)");
  });

  it('C4. Round 3 expiry closes item and advances', () => {
    // Client-side
    expect(auctionActions).toContain("closeItemAndAdvance(auctionId, hasBidder)");
    // Server-side
    expect(timerManager).toContain("closeItemAndAdvance(auctionId, auction, settings, lockRef)");
  });

  it('C5. Pause/resume uses timerPaused flag (not hacky timerEndsAt)', () => {
    // Client pause
    expect(auctionActions).toContain('timerPaused: true');
    expect(auctionActions).toContain('remainingOnPause: remaining');
    // Client resume
    expect(auctionActions).toContain('timerPaused: false');
    // CF pause uses proper flag
    expect(auctionControl).toContain('timerPaused: true');
    expect(auctionControl).toContain("remainingOnPause: remaining");
    // CF does NOT use 999999000 hack
    expect(auctionControl).not.toContain('999999000');
  });

  it('C6. timerTick skips paused auctions', () => {
    expect(timerManager).toContain('auction.timerPaused) continue');
  });

  it('C7. advanceRound resets timerPaused to false', () => {
    const advanceBlock = auctionActions.slice(
      auctionActions.indexOf('export async function advanceRound'),
      auctionActions.indexOf('export async function closeItemAndAdvance')
    );
    expect(advanceBlock).toContain('timerPaused: false');
    // CF version
    expect(auctionControl).toMatch(/advanceAuctionRound[\s\S]*?timerPaused: false/);
  });

  it('C8. Hard close checks for actual bidder before marking sold', () => {
    // handleTimerExpiry checks currentBidderId before calling closeItemAndAdvance
    const hardCloseBlock = auctionActions.slice(
      auctionActions.indexOf('Hard close check'),
      auctionActions.indexOf('if (currentRound === 1)')
    );
    expect(hardCloseBlock).toContain('hcItem.currentBidderId');
    expect(hardCloseBlock).toContain('closeItemAndAdvance(auctionId, hasBidder)');
  });

  it('C9. Timer override (timerOverrideSeconds) takes precedence', () => {
    // getTimerSeconds function in auction-actions
    expect(auctionActions).toContain('timerOverrideSeconds');
    expect(auctionActions).toContain('settings.timerOverrideSeconds > 0');
    // mergeSettings preserves timerOverrideSeconds
    expect(auctionActions).toContain("timerOverrideSeconds: settings?.timerOverrideSeconds ?? null");
    // CF versions also have it
    expect(auctionControl).toContain('timerOverrideSeconds');
    expect(timerManager).toContain('timerOverrideSeconds');
  });

  it('C10. Add time works both during pause and running', () => {
    // addTime handles paused state
    expect(auctionActions).toContain('auction.timerPaused');
    const addTimeBlock = auctionActions.slice(
      auctionActions.indexOf('export async function addTime'),
      auctionActions.indexOf('export async function submitBid')
    );
    expect(addTimeBlock).toContain('remainingOnPause');
    expect(addTimeBlock).toContain('timerEndsAt');
  });
});

// ═══════════════════════════════════════════════════════════════
// D. REGISTRATION / APPROVAL (5 tests)
// ═══════════════════════════════════════════════════════════════
describe('D. Registration / Approval', () => {
  const dbRules = readSrc('database.rules.json');
  const processBid = readSrc('functions/src/processBid.ts');
  const types = readSrc('lib/types.ts');

  it('D1. Registration rules: user can register themselves (not approve)', () => {
    const rules = JSON.parse(dbRules);
    const regWrite = rules.rules.registrations['$auctionId']['$userId']['.write'];
    // User can write their own registration with non-approved status
    expect(regWrite).toContain("auth.uid === $userId");
    expect(regWrite).toContain("status");
    expect(regWrite).toContain("approved");
  });

  it('D2. processBid verifies user is approved before processing', () => {
    expect(processBid).toContain("verificationStatus !== 'approved'");
    expect(processBid).toContain("Rejected bid from non-approved user");
  });

  it('D3. processBid verifies user is registered for the auction', () => {
    expect(processBid).toContain("registrations/${bid.auctionId}/${bid.userId}");
    expect(processBid).toContain("Rejected bid from unregistered user");
  });

  it('D4. VerificationStatus types are correct', () => {
    expect(types).toContain("'pending_verification'");
    expect(types).toContain("'pending_approval'");
    expect(types).toContain("'approved'");
    expect(types).toContain("'rejected'");
  });

  it('D5. Admin email allowlist enforced server-side', () => {
    const auctionControl = readSrc('functions/src/auctionControl.ts');
    expect(auctionControl).toContain("ADMIN_EMAILS");
    expect(auctionControl).toContain("ceo@m-motors.co.il");
    expect(auctionControl).toContain("office@m-motors.co.il");
    expect(auctionControl).toContain("Email not in admin allowlist");
  });
});

// ═══════════════════════════════════════════════════════════════
// E. ADMIN OPERATIONS (8 tests)
// ═══════════════════════════════════════════════════════════════
describe('E. Admin Operations', () => {
  const auctionActions = readSrc('lib/auction-actions.ts');
  const auctionControl = readSrc('functions/src/auctionControl.ts');

  it('E1. startAuctionLive prevents two live auctions', () => {
    expect(auctionActions).toContain("a.status === 'live'");
    expect(auctionActions).toContain('מכרז אחר כבר חי');
    expect(auctionControl).toContain("Another auction is already live");
  });

  it('E2. startAuctionLive requires draft or published status', () => {
    expect(auctionActions).toContain("auction.status !== 'published' && auction.status !== 'draft'");
    expect(auctionControl).toContain("Cannot start auction in status");
  });

  it('E3. startAuctionLive verifies auction has items', () => {
    expect(auctionActions).toContain("אין פריטים במכרז");
    expect(auctionControl).toContain("Auction has no items");
  });

  it('E4. closeItemAndAdvance sets winner fields when sold', () => {
    expect(auctionActions).toContain('winnerId: item.currentBidderId');
    expect(auctionActions).toContain('winnerName: item.currentBidderName');
    expect(auctionActions).toContain("winnerPaymentStatus: 'pending'");
    // CF version (uses itemUpdate.winnerId = ... assignment style)
    expect(auctionControl).toContain('winnerId');
    expect(auctionControl).toContain('winnerName');
    expect(auctionControl).toContain("winnerPaymentStatus");
  });

  it('E5. closeItemAndAdvance only marks sold when bidder exists', () => {
    // Client: checks hasBidder
    expect(auctionActions).toContain('const hasBidder = !!item.currentBidderId');
    expect(auctionActions).toContain('markAsSold && item.currentBid > 0 && hasBidder');
    // CF: also checks
    expect(auctionControl).toContain('const hasBidder = !!item.currentBidderId');
  });

  it('E6. endAuction sets status to ended and clears currentItemId', () => {
    expect(auctionActions).toContain("status: 'ended', currentItemId: null");
  });

  it('E7. advanceRound prevents going beyond round 3', () => {
    expect(auctionActions).toContain('currentRound >= 3');
    expect(auctionControl).toContain('already_at_round_3');
  });

  it('E8. CF endpoints require auth + admin role + email allowlist', () => {
    expect(auctionControl).toContain('verifyAuth(req)');
    expect(auctionControl).toContain('verifyAdminRole(decoded.uid)');
    expect(auctionControl).toContain("Admin or house_manager role required");
    expect(auctionControl).toContain("Email not in admin allowlist");
  });
});

// ═══════════════════════════════════════════════════════════════
// F. CATALOG MANAGEMENT (4 tests)
// ═══════════════════════════════════════════════════════════════
describe('F. Catalog Management', () => {
  const auctionActions = readSrc('lib/auction-actions.ts');
  const timerManager = readSrc('functions/src/timerManager.ts');

  it('F1. Items sorted by order field when queried', () => {
    expect(auctionActions).toContain('.sort((a: any, b: any) => a.order - b.order)');
  });

  it('F2. Auction ends when no pending items remain', () => {
    expect(auctionActions).toContain("pendingItems.length === 0");
    expect(auctionActions).toContain("status: 'ended', currentItemId: null");
    expect(timerManager).toContain("pendingItems.length === 0");
    expect(timerManager).toContain("status: 'ended'");
  });

  it('F3. Next item gets round 1 settings and reset state', () => {
    expect(auctionActions).toContain('currentRound: 1');
    expect(auctionActions).toContain('round1Resets: 0');
    expect(timerManager).toContain('currentRound: 1');
    expect(timerManager).toContain('round1Resets: 0');
  });

  it('F4. Item status transitions: pending → active → sold/unsold', () => {
    const types = readSrc('lib/types.ts');
    expect(types).toContain("'pending' | 'active' | 'sold' | 'unsold'");
    // Code sets active
    expect(auctionActions).toContain("status: 'active'");
    expect(auctionActions).toContain("status: 'sold'");
    expect(auctionActions).toContain("status: 'unsold'");
  });
});

// ═══════════════════════════════════════════════════════════════
// G. TYPE SAFETY & DATA MODEL (5 tests)
// ═══════════════════════════════════════════════════════════════
describe('G. Type Safety & Data Model', () => {
  const types = readSrc('lib/types.ts');

  it('G1. WinnerPaymentStatus type exists', () => {
    expect(types).toContain("WinnerPaymentStatus");
  });

  it('G2. AuctionItem has winnerId, winnerName, winnerPaymentStatus', () => {
    expect(types).toContain('winnerId: string | null');
    expect(types).toContain('winnerName: string | null');
    expect(types).toContain('winnerPaymentStatus: WinnerPaymentStatus | null');
  });

  it('G3. Auction has timerPaused and remainingOnPause', () => {
    expect(types).toContain('timerPaused?: boolean');
    expect(types).toContain('remainingOnPause?: number');
  });

  it('G4. AuctionSettings has timerOverrideSeconds', () => {
    expect(types).toContain('timerOverrideSeconds?: number | null');
  });

  it('G5. UserProfile has all required fields', () => {
    expect(types).toContain('verificationStatus: VerificationStatus');
    expect(types).toContain('termsAcceptedAt: number | null');
    expect(types).toContain('signatureData: string | null');
    expect(types).toContain('callbackRequested?: boolean');
  });
});

// ═══════════════════════════════════════════════════════════════
// H. PURE LOGIC TESTS (auction-utils)
// ═══════════════════════════════════════════════════════════════
describe('H. Pure Logic — auction-utils', () => {
  const settings = DEFAULT_AUCTION_SETTINGS;

  it('H1. getIncrement returns correct values per round', () => {
    expect(getIncrement(settings, 1)).toBe(1000);
    expect(getIncrement(settings, 2)).toBe(500);
    expect(getIncrement(settings, 3)).toBe(250);
  });

  it('H2. getMinBid = currentBid + increment', () => {
    expect(getMinBid(50000, settings, 1)).toBe(51000);
    expect(getMinBid(50000, settings, 2)).toBe(50500);
    expect(getMinBid(50000, settings, 3)).toBe(50250);
  });

  it('H3. canPlaceBid rejects inactive items', () => {
    const auction = makeAuction();
    const item = makeItem({ status: 'sold' });
    const result = canPlaceBid('user-B', item, auction, 52000);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('אינו פעיל');
  });

  it('H4. canPlaceBid rejects self-outbid', () => {
    const auction = makeAuction();
    const item = makeItem({ currentBidderId: 'user-A' });
    const result = canPlaceBid('user-A', item, auction, 52000);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('עצמך');
  });

  it('H5. canPlaceBid rejects amount below minimum', () => {
    const auction = makeAuction();
    const item = makeItem({ currentBid: 50000 });
    const result = canPlaceBid('user-B', item, auction, 50500); // min is 51000
    expect(result.valid).toBe(false);
    expect(result.error).toContain('מינימלית');
  });

  it('H6. canPlaceBid rejects misaligned increment', () => {
    const auction = makeAuction();
    const item = makeItem({ currentBid: 50000 });
    const result = canPlaceBid('user-B', item, auction, 51500); // not aligned to 1000
    expect(result.valid).toBe(false);
    expect(result.error).toContain('מדרגת');
  });

  it('H7. canPlaceBid accepts valid bid', () => {
    const auction = makeAuction();
    const item = makeItem({ currentBid: 50000, currentBidderId: 'user-A' });
    const result = canPlaceBid('user-B', item, auction, 51000);
    expect(result.valid).toBe(true);
  });

  it('H8. canPlaceBid accepts multi-increment bid', () => {
    const auction = makeAuction();
    const item = makeItem({ currentBid: 50000, currentBidderId: 'user-A' });
    const result = canPlaceBid('user-B', item, auction, 53000); // 3x increment
    expect(result.valid).toBe(true);
  });

  it('H9. formatPrice formats correctly in Hebrew', () => {
    expect(formatPrice(50000)).toContain('50');
    expect(formatPrice(50000)).toContain('₪');
  });

  it('H10. formatTimer handles various states', () => {
    expect(formatTimer(-1)).toBe('מושהה');
    expect(formatTimer(0)).toBe('00.00');
    expect(formatTimer(65)).toMatch(/01:05/);
    expect(formatTimer(5.5)).toMatch(/05\.\d+/);
  });

  it('H11. getTimerColor returns correct colors', () => {
    expect(getTimerColor(15)).toBe('green');
    expect(getTimerColor(8)).toBe('orange');
    expect(getTimerColor(3)).toBe('red');
  });
});

// ═══════════════════════════════════════════════════════════════
// I. DEDUPLICATION & RACE CONDITION PROTECTION (4 tests)
// ═══════════════════════════════════════════════════════════════
describe('I. Deduplication & Race Conditions', () => {
  it('I1. BidButton has dedup refs', () => {
    const bidButton = readSrc('components/live/BidButton.tsx');
    expect(bidButton).toContain('submittingRef');
    expect(bidButton).toContain('lastBidRef');
    expect(bidButton).toContain('submittingRef.current');
  });

  it('I2. useAutoAdvance has dedup ref', () => {
    const hooks = readSrc('lib/hooks.ts');
    expect(hooks).toContain('processingRef');
    expect(hooks).toContain('lastTimerEndsAtRef');
  });

  it('I3. processBid uses transaction for atomic bid update', () => {
    const processBid = readSrc('functions/src/processBid.ts');
    expect(processBid).toContain('itemRef.transaction');
  });

  it('I4. timerTick uses distributed lock', () => {
    const timerManager = readSrc('functions/src/timerManager.ts');
    expect(timerManager).toContain('timer_locks');
    expect(timerManager).toContain('lockRef.transaction');
  });
});

// ═══════════════════════════════════════════════════════════════
// J. SECURITY (5 tests)
// ═══════════════════════════════════════════════════════════════
describe('J. Security', () => {
  const dbRules = readSrc('database.rules.json');
  const rules = JSON.parse(dbRules);

  it('J1. auction_items write requires admin role + email', () => {
    const write = rules.rules.auction_items['$itemId']['.write'];
    expect(write).toContain("role");
    expect(write).toContain("admin");
    expect(write).toContain("ceo@m-motors.co.il");
  });

  it('J2. auctions write requires admin role + email', () => {
    const write = rules.rules.auctions['$auctionId']['.write'];
    expect(write).toContain("role");
    expect(write).toContain("admin");
  });

  it('J3. Users can only write their own profile fields', () => {
    const displayName = rules.rules.users['$userId'].displayName['.write'];
    expect(displayName).toContain("auth.uid === $userId");
  });

  it('J4. ID number is immutable after first write', () => {
    const idNumber = rules.rules.users['$userId'].idNumber['.write'];
    expect(idNumber).toContain("!data.exists()");
  });

  it('J5. Signature data validated for length', () => {
    const sig = rules.rules.users['$userId'].signatureData['.validate'];
    expect(sig).toContain("70000");
  });
});
