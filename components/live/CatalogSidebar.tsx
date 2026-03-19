'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
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
    <div className="space-y-3" role="complementary" aria-label="קטלוג המכרז">
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
          <div className="space-y-1 max-h-[160px] overflow-y-auto">
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
  const isCompleted = isSold || isUnsold;
  const hasThumb = item.images?.length > 0;

  return (
    <div
      className={`flex items-center gap-2.5 p-2 rounded-lg transition-smooth text-sm
        ${isActive ? 'bg-accent-muted border border-accent/25' : isCompleted ? 'bg-bg-elevated/30' : 'bg-bg-elevated/50 hover:bg-bg-elevated'}`}
    >
      {/* Thumbnail or order number */}
      {hasThumb ? (
        <div className={`relative w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 ${isCompleted && !isActive ? 'opacity-50' : ''}`}>
          <Image src={item.images[0]} alt="" fill className="object-cover" sizes="36px" />
          {isSold && (
            <div className="absolute inset-0 bg-bid-price/40 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 20 20" fill="white" aria-hidden="true">
                <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/>
              </svg>
            </div>
          )}
        </div>
      ) : (
        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
          ${isActive ? 'bg-accent text-bg-primary' : isSold ? 'bg-bid-price/20 text-bid-price' : isUnsold ? 'bg-timer-orange/20 text-timer-orange' : 'bg-bg-elevated text-text-secondary'}`}>
          {item.order}
        </span>
      )}

      <div className="flex-1 min-w-0">
        <div className={`truncate font-medium text-xs ${isCompleted && !isActive ? 'text-text-secondary/70' : ''}`}>{item.title}</div>
        <div className="text-[10px] text-text-secondary">
          {isSold ? (
            <span className="text-bid-price">נמכר {formatPrice(item.soldPrice || item.currentBid)}</span>
          ) : isUnsold ? (
            <span className="text-timer-orange">לא נמכר</span>
          ) : isActive ? (
            <span className="text-accent font-bold text-mono-nums">{formatPrice(item.currentBid)}</span>
          ) : (
            <span className="text-mono-nums">
              {formatPrice(item.openingPrice)}
              {item.preBidPrice && item.preBidPrice > item.openingPrice && (
                <span className="text-bid-price mr-1"> ({formatPrice(item.preBidPrice)})</span>
              )}
            </span>
          )}
        </div>
      </div>
      {isActive && <span className="text-live-dot text-lg animate-pulse" aria-hidden="true">●</span>}
    </div>
  );
}
