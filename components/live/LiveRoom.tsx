'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useCurrentItem, useBidHistory, useLiveChat, useCatalog, useViewerCount, useTimer, useRegistration, useLiveAuction, useAuction } from '@/lib/hooks';
import { trackViewer } from '@/lib/presence';
import AuctionTimer from './AuctionTimer';
import BidButton from './BidButton';
import CurrentItem from './CurrentItem';
import BidHistory from './BidHistory';
import CatalogSidebar from './CatalogSidebar';
import LiveChat from './LiveChat';
import LiveBadge from '../ui/LiveBadge';
import LoadingSpinner from '../ui/LoadingSpinner';

export default function LiveRoom() {
  const { user } = useAuth();
  const { auctionId, loading: liveLoading } = useLiveAuction();
  const { item, auction, loading: itemLoading } = useCurrentItem(auctionId);
  const bids = useBidHistory(auctionId, item?.id || null);
  const messages = useLiveChat(auctionId);
  const { items } = useCatalog(auctionId);
  const viewerCount = useViewerCount(auctionId);
  const secondsLeft = useTimer(auctionId);
  const { registered } = useRegistration(auctionId, user?.uid || null);

  // Track viewer presence
  useEffect(() => {
    if (!auctionId) return;
    const unsub = trackViewer(auctionId);
    return () => unsub();
  }, [auctionId]);

  if (liveLoading || itemLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!auctionId || !auction) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="text-6xl">📡</div>
        <h1 className="text-2xl font-bold">אין מכרז חי כרגע</h1>
        <p className="text-text-secondary">המכרז הבא יתחיל בקרוב. הישארו מעודכנים!</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header */}
      <div className="glass sticky top-0 z-40 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold">NBC</span>
            <LiveBadge />
            <span className="text-sm text-text-secondary hidden md:inline">{auction.title}</span>
          </div>
          <div className="flex items-center gap-2 text-text-secondary text-sm">
            <span>👁</span>
            <span>{viewerCount} צופים</span>
          </div>
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden lg:grid grid-cols-[280px_1fr_280px] max-w-7xl mx-auto gap-4 p-4">
        {/* Left Panel - Timer + Chat */}
        <div className="space-y-4">
          <AuctionTimer secondsLeft={secondsLeft} currentRound={auction.currentRound} />
          <div className="glass rounded-xl p-3 h-[400px]">
            <LiveChat auctionId={auction.id} messages={messages} registered={registered} />
          </div>
        </div>

        {/* Center Stage */}
        <div className="space-y-4">
          {item ? (
            <>
              <CurrentItem item={item} totalItems={items.length} />
              <BidButton auction={auction} item={item} registered={registered} />
              <div className="glass rounded-xl p-4">
                <h3 className="text-sm font-semibold text-text-secondary mb-2">היסטוריית הצעות</h3>
                <BidHistory bids={bids} />
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-64 text-text-secondary">
              ממתין לפריט הבא...
            </div>
          )}
        </div>

        {/* Right Panel - Catalog */}
        <div className="glass rounded-xl p-3">
          <CatalogSidebar items={items} currentItemId={auction.currentItemId} />
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="lg:hidden">
        {item ? (
          <div className="space-y-3 pb-24">
            {/* Car image */}
            <CurrentItem item={item} totalItems={items.length} />

            {/* Catalog strip - horizontal scroll */}
            <div className="px-4">
              <div className="flex gap-2 overflow-x-auto pb-2">
                {items.map((catItem) => (
                  <div
                    key={catItem.id}
                    className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs
                      ${catItem.id === auction.currentItemId
                        ? 'bg-accent/20 border border-accent/30 text-white'
                        : catItem.status === 'sold'
                          ? 'bg-bid-price/10 text-bid-price'
                          : 'bg-bg-elevated text-text-secondary'
                      }`}
                  >
                    {catItem.order}. {catItem.title.split(' ').slice(0, 2).join(' ')}
                  </div>
                ))}
              </div>
            </div>

            {/* Bid history */}
            <div className="px-4">
              <BidHistory bids={bids.slice(0, 5)} />
            </div>

            {/* Chat (collapsed by default on mobile) */}
            <div className="px-4">
              <details className="glass rounded-xl">
                <summary className="p-3 text-sm font-semibold text-text-secondary cursor-pointer">
                  צ&apos;אט חי ({messages.length} הודעות)
                </summary>
                <div className="p-3 pt-0 h-48">
                  <LiveChat auctionId={auction.id} messages={messages} registered={registered} />
                </div>
              </details>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-64 text-text-secondary">
            ממתין לפריט הבא...
          </div>
        )}

        {/* Mobile sticky bottom bar */}
        {item && (
          <div className="fixed bottom-0 left-0 right-0 glass border-t border-border p-3 flex items-center gap-3 z-50">
            <div className="flex-shrink-0">
              <AuctionTimer secondsLeft={secondsLeft} currentRound={auction.currentRound} />
            </div>
            <div className="flex-1">
              <BidButton auction={auction} item={item} registered={registered} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
