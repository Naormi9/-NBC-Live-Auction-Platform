'use client';

import { BidHistoryEntry } from '@/lib/types';
import { formatPrice } from '@/lib/auction-utils';

interface BidHistoryProps {
  bids: BidHistoryEntry[];
}

export default function BidHistory({ bids }: BidHistoryProps) {
  if (bids.length === 0) {
    return (
      <div className="text-center text-text-secondary text-sm py-4">
        אין הצעות עדיין
      </div>
    );
  }

  return (
    <div className="space-y-1 max-h-60 overflow-y-auto" role="log" aria-label="היסטוריית הצעות">
      {bids.map((bid, i) => (
        <div
          key={`${bid.userId}-${bid.amount}-${bid.timestamp}`}
          className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-smooth
            ${i === 0 ? 'bg-bid-price/10 border border-bid-price/20 animate-fade-in' : 'bg-bg-elevated/50'}`}
        >
          <div className="flex items-center gap-2">
            {i === 0 && (
              <span className="w-5 h-5 rounded-full bg-bid-price/20 flex items-center justify-center flex-shrink-0" aria-hidden="true">
                <svg width="10" height="10" viewBox="0 0 20 20" fill="currentColor" className="text-bid-price">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.176 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.063 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69L9.05 2.927z"/>
                </svg>
              </span>
            )}
            <span className={`${i === 0 ? 'text-white font-medium' : 'text-text-secondary'}`}>{bid.userDisplayName}</span>
            <span className="text-xs text-text-secondary/60">ס׳{bid.round}</span>
          </div>
          <span className={`font-bold text-mono-nums ${i === 0 ? 'text-bid-price' : 'text-white'}`}>
            {formatPrice(bid.amount)}
          </span>
        </div>
      ))}
    </div>
  );
}
