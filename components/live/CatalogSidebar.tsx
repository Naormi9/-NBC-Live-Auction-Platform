'use client';

import { AuctionItem } from '@/lib/types';
import { formatPrice } from '@/lib/auction-utils';

interface CatalogSidebarProps {
  items: AuctionItem[];
  currentItemId: string | null;
}

export default function CatalogSidebar({ items, currentItemId }: CatalogSidebarProps) {
  return (
    <div className="space-y-1">
      <h3 className="text-sm font-semibold text-text-secondary mb-2 px-2">קטלוג המכרז</h3>
      <div className="space-y-1 max-h-[500px] overflow-y-auto">
        {items.map((item) => {
          const isActive = item.id === currentItemId;
          const isSold = item.status === 'sold';
          const isUnsold = item.status === 'unsold';

          return (
            <div
              key={item.id}
              className={`flex items-center gap-3 p-2 rounded-lg transition-smooth text-sm
                ${isActive ? 'bg-accent/20 border border-accent/30' : 'bg-bg-elevated/50 hover:bg-bg-elevated'}`}
            >
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                ${isActive ? 'bg-accent text-white' : isSold ? 'bg-bid-price text-white' : isUnsold ? 'bg-timer-orange text-white' : 'bg-bg-elevated text-text-secondary'}`}>
                {item.order}
              </span>
              <div className="flex-1 min-w-0">
                <div className="truncate font-medium">{item.title}</div>
                <div className="text-xs text-text-secondary">
                  {isSold ? (
                    <span className="text-bid-price">נמכר ב-{formatPrice(item.soldPrice || item.currentBid)}</span>
                  ) : isUnsold ? (
                    <span className="text-timer-orange">לא נמכר</span>
                  ) : isActive ? (
                    <span className="text-accent">על הבמה</span>
                  ) : (
                    formatPrice(item.openingPrice)
                  )}
                </div>
              </div>
              {isActive && <span className="text-live-dot text-lg">●</span>}
              {isSold && <span className="text-bid-price">✓</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
