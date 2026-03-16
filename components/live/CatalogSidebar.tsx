'use client';

import { useEffect, useRef } from 'react';
import { AuctionItem } from '@/lib/types';
import { formatPrice } from '@/lib/auction-utils';

interface CatalogSidebarProps {
  items: AuctionItem[];
  currentItemId: string | null;
}

export default function CatalogSidebar({ items, currentItemId }: CatalogSidebarProps) {
  const activeRef = useRef<HTMLDivElement>(null);
  const activeItem = items.find((i) => i.id === currentItemId);
  const upcomingItems = items.filter((i) => i.status === 'pending');
  const completedItems = items.filter((i) => i.status === 'sold' || i.status === 'unsold');

  // Auto-scroll to active item when it changes
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentItemId]);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-text-secondary px-2">
        קטלוג המכרז ({items.length} פריטים)
      </h3>

      {/* Active item */}
      {activeItem && (
        <div className="px-1" ref={activeRef}>
          <div className="text-[10px] uppercase tracking-wider text-accent font-bold px-2 mb-1">על הבמה</div>
          <ItemRow item={activeItem} isActive />
        </div>
      )}

      {/* Upcoming */}
      {upcomingItems.length > 0 && (
        <div className="px-1">
          <div className="text-[10px] uppercase tracking-wider text-text-secondary font-bold px-2 mb-1">
            הבאים בתור ({upcomingItems.length})
          </div>
          <div className="space-y-1 max-h-[220px] overflow-y-auto">
            {upcomingItems.map((item) => (
              <ItemRow key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}

      {/* Completed */}
      {completedItems.length > 0 && (
        <div className="px-1">
          <div className="text-[10px] uppercase tracking-wider text-text-secondary/60 font-bold px-2 mb-1">
            הושלמו ({completedItems.length})
          </div>
          <div className="space-y-1 max-h-[160px] overflow-y-auto opacity-70">
            {completedItems.map((item) => (
              <ItemRow key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ItemRow({ item, isActive = false }: { item: AuctionItem; isActive?: boolean }) {
  const isSold = item.status === 'sold';
  const isUnsold = item.status === 'unsold';

  return (
    <div
      className={`flex items-center gap-3 p-2 rounded-lg transition-smooth text-sm
        ${isActive ? 'bg-accent/20 border border-accent/30' : 'bg-bg-elevated/50 hover:bg-bg-elevated'}`}
    >
      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
        ${isActive ? 'bg-accent text-white' : isSold ? 'bg-bid-price text-white' : isUnsold ? 'bg-timer-orange text-white' : 'bg-bg-elevated text-text-secondary'}`}>
        {item.order}
      </span>
      <div className="flex-1 min-w-0">
        <div className="truncate font-medium text-xs">{item.title}</div>
        <div className="text-[10px] text-text-secondary">
          {isSold ? (
            <span className="text-bid-price">נמכר {formatPrice(item.soldPrice || item.currentBid)}</span>
          ) : isUnsold ? (
            <span className="text-timer-orange">לא נמכר</span>
          ) : isActive ? (
            <span className="text-accent font-bold">{formatPrice(item.currentBid)}</span>
          ) : (
            <>
              {formatPrice(item.openingPrice)}
              {item.preBidPrice && item.preBidPrice > item.openingPrice && (
                <span className="text-bid-price mr-1"> (הצעה: {formatPrice(item.preBidPrice)})</span>
              )}
            </>
          )}
        </div>
      </div>
      {isActive && <span className="text-live-dot text-lg animate-pulse">●</span>}
      {isSold && <span className="text-bid-price text-xs">✓</span>}
    </div>
  );
}
