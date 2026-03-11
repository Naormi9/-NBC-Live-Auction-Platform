import { Auction, AuctionItem, AuctionSettings } from './types';

export function getIncrement(settings: AuctionSettings, round: 1 | 2 | 3): number {
  return settings[`round${round}`].increment;
}

export function getTimerDuration(settings: AuctionSettings, round: 1 | 2 | 3): number {
  return settings[`round${round}`].timerSeconds;
}

export function getMinBid(currentBid: number, settings: AuctionSettings, round: 1 | 2 | 3): number {
  return currentBid + getIncrement(settings, round);
}

export function canPlaceBid(
  userId: string,
  item: AuctionItem,
  auction: Auction,
  amount: number
): { valid: boolean; error?: string } {
  if (item.status !== 'active') {
    return { valid: false, error: 'הפריט אינו פעיל' };
  }

  if (item.currentBidderId === userId) {
    return { valid: false, error: 'אינך יכול להקפיץ מעל עצמך' };
  }

  const minBid = getMinBid(item.currentBid, auction.settings, auction.currentRound);
  if (amount < minBid) {
    return { valid: false, error: `הצעה מינימלית: ₪${minBid.toLocaleString()}` };
  }

  return { valid: true };
}

export function formatPrice(price: number): string {
  return `₪${price.toLocaleString('he-IL')}`;
}

export function formatTimer(seconds: number): string {
  if (seconds <= 0) return '00.00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const hundredths = Math.floor((seconds % 1) * 100);
  if (mins > 0) {
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  // Per spec: show seconds and hundredths
  return `${secs.toString().padStart(2, '0')}.${hundredths.toString().padStart(2, '0')}`;
}

export function getTimerColor(seconds: number): 'green' | 'orange' | 'red' {
  if (seconds > 10) return 'green';
  if (seconds > 5) return 'orange';
  return 'red';
}

export const DEFAULT_AUCTION_SETTINGS: AuctionSettings = {
  round1: { increment: 1000, timerSeconds: 45 },
  round2: { increment: 500, timerSeconds: 30 },
  round3: { increment: 250, timerSeconds: 30 },
  hardCloseMinutes: 30,
};
