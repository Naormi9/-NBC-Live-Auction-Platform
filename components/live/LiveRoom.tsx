'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useCurrentItem, useBidHistory, useLiveChat, useCatalog, useViewerCount, useTimer, useRegistration, useLiveAuction, useAuction } from '@/lib/hooks';
import { trackViewer } from '@/lib/presence';
import { playOutbidSound, playTimerWarningSound, playTimer10SecSound, playTimerEndSound, playItemSoldSound } from '@/lib/sounds';
import Link from 'next/link';
import AuctionTimer from './AuctionTimer';
import BidButton from './BidButton';
import CurrentItem from './CurrentItem';
import BidHistory from './BidHistory';
import CatalogSidebar from './CatalogSidebar';
import LiveChat from './LiveChat';
import RegisterPrompt from './RegisterPrompt';
import LiveBadge from '../ui/LiveBadge';
import LoadingSpinner from '../ui/LoadingSpinner';
import { LogoCompact } from '../ui/Logo';

export default function LiveRoom() {
  const { user, profile } = useAuth();
  const { auctionId, loading: liveLoading } = useLiveAuction();
  const { item, auction, loading: itemLoading } = useCurrentItem(auctionId);
  const bids = useBidHistory(auctionId, item?.id || null);
  const messages = useLiveChat(auctionId);
  const { items } = useCatalog(auctionId);
  const viewerCount = useViewerCount(auctionId);
  const secondsLeft = useTimer(auctionId);
  // Auto-register approved users entering the live room
  const { registered } = useRegistration(auctionId, user?.uid || null, true, profile?.verificationStatus);

  const prevBidderRef = useRef<string | null>(null);
  const prevItemStatusRef = useRef<string | null>(null);
  const timer10Fired = useRef(false);
  const timerWarningFired = useRef(false);
  const timerEndFired = useRef(false);

  // Track viewer presence
  useEffect(() => {
    if (!auctionId) return;
    const unsub = trackViewer(auctionId, user?.uid);
    return () => unsub();
  }, [auctionId, user?.uid]);

  // Wake Lock: keep screen awake during live auction (mobile)
  useEffect(() => {
    if (!auctionId) return;
    let wakeLock: any = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await (navigator as any).wakeLock.request('screen');
        }
      } catch {
        // Wake Lock not supported or denied — fail gracefully
      }
    };
    requestWakeLock();
    // Re-acquire on visibility change (tab becomes active again)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') requestWakeLock();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (wakeLock) wakeLock.release().catch(() => {});
    };
  }, [auctionId]);

  // Sound: outbid detection
  useEffect(() => {
    if (!item || !user) return;
    const prev = prevBidderRef.current;
    prevBidderRef.current = item.currentBidderId;
    // If I was leading and now someone else is
    if (prev === user.uid && item.currentBidderId !== user.uid && item.currentBidderId) {
      playOutbidSound();
    }
  }, [item?.currentBidderId, user?.uid]);

  // Sound: item sold
  useEffect(() => {
    if (!item) return;
    const prev = prevItemStatusRef.current;
    prevItemStatusRef.current = item.status;
    if (prev === 'active' && item.status === 'sold') {
      playItemSoldSound();
    }
  }, [item?.status]);

  // Sound: timer warnings (10 seconds, 5 seconds, end)
  useEffect(() => {
    if (secondsLeft < 0) {
      // Paused — reset all
      timer10Fired.current = false;
      timerWarningFired.current = false;
      timerEndFired.current = false;
      return;
    }

    if (secondsLeft > 10) {
      timer10Fired.current = false;
      timerWarningFired.current = false;
      timerEndFired.current = false;
      return;
    }

    // 10 seconds warning
    if (secondsLeft <= 10 && secondsLeft > 5 && !timer10Fired.current) {
      timer10Fired.current = true;
      playTimer10SecSound();
    }

    // 5 seconds warning
    if (secondsLeft <= 5 && secondsLeft > 0.5 && !timerWarningFired.current) {
      timerWarningFired.current = true;
      playTimerWarningSound();
    }

    // Timer end
    if (secondsLeft <= 0.5 && secondsLeft >= 0 && !timerEndFired.current) {
      timerEndFired.current = true;
      playTimerEndSound();
    }
  }, [secondsLeft]);

  if (liveLoading || itemLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const roundKey = auction ? `round${auction.currentRound}` as 'round1' | 'round2' | 'round3' : 'round1';
  const currentIncrement = auction?.settings?.[roundKey]?.increment;

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
            <LogoCompact height={24} />
            <LiveBadge />
            <span className="text-sm text-text-secondary hidden md:inline">{auction.title}</span>
          </div>
          <div className="flex items-center gap-3 text-text-secondary text-sm">
            <span>👁 {viewerCount} צופים</span>
            {auctionId && (
              <>
                <Link
                  href={`/auctions/${auctionId}`}
                  className="hidden md:inline px-2 py-1 text-xs bg-bg-elevated hover:bg-white/10 rounded-lg transition-smooth"
                >
                  חזרה לקטלוג
                </Link>
                <a
                  href={`/auctions/${auctionId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden md:inline px-2 py-1 text-xs bg-bg-elevated hover:bg-white/10 rounded-lg transition-smooth"
                >
                  קטלוג בטאב חדש ↗
                </a>
              </>
            )}
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
              <CurrentItem item={item} totalItems={items.length} currentRound={auction.currentRound} increment={currentIncrement} />
              {!registered && (
                <RegisterPrompt auctionId={auction.id} isLoggedIn={!!user} />
              )}
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
            <CurrentItem item={item} totalItems={items.length} currentRound={auction.currentRound} increment={currentIncrement} />

            {/* Registration prompt on mobile */}
            {!registered && (
              <div className="px-4">
                <RegisterPrompt auctionId={auction.id} isLoggedIn={!!user} />
              </div>
            )}

            {/* Catalog navigation - mobile */}
            {auctionId && (
              <div className="px-4 flex gap-2">
                <Link
                  href={`/auctions/${auctionId}`}
                  className="text-xs px-3 py-1.5 bg-bg-elevated hover:bg-white/10 rounded-lg transition-smooth text-text-secondary"
                >
                  חזרה לקטלוג
                </Link>
                <a
                  href={`/auctions/${auctionId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-3 py-1.5 bg-bg-elevated hover:bg-white/10 rounded-lg transition-smooth text-text-secondary"
                >
                  קטלוג בטאב חדש ↗
                </a>
              </div>
            )}

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
