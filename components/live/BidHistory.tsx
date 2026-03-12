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
    <div className="space-y-1 max-h-60 overflow-y-auto">
      {bids.map((bid, i) => (
        <div
          key={`${bid.userId}-${bid.amount}-${bid.timestamp}`}
          className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm
            ${i === 0 ? 'bg-bid-price/10 border border-bid-price/20' : 'bg-bg-elevated/50'}`}
        >
          <div className="flex items-center gap-2">
            <span className="text-text-secondary">{bid.userDisplayName}</span>
            <span className="text-xs text-text-secondary">סיבוב {bid.round}</span>
          </div>
          <span className={`font-bold ${i === 0 ? 'text-bid-price' : 'text-white'}`}>
            {formatPrice(bid.amount)}
          </span>
        </div>
      ))}
    </div>
  );
}
