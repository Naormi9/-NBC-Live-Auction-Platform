'use client';

import { useState, useRef, useEffect } from 'react';
import { ref, push, serverTimestamp } from 'firebase/database';
import { db } from '@/lib/firebase';
import * as actions from '@/lib/auction-actions';
import { useAuth } from '@/lib/auth-context';
import { useCurrentItem, useLiveAuction, useAuction, useCatalog, useViewerCount, useTimer, useBidHistory, useLiveChat, useAutoAdvance } from '@/lib/hooks';
import { formatPrice, formatTimer, getTimerColor } from '@/lib/auction-utils';
import LiveBadge from '../ui/LiveBadge';
import LoadingSpinner from '../ui/LoadingSpinner';
import toast from 'react-hot-toast';

export default function AuctioneerConsole() {
  const { user, profile } = useAuth();
  const { auctionId, loading: liveLoading } = useLiveAuction();
  const { auction } = useAuction(auctionId);
  const { item } = useCurrentItem(auctionId);
  const { items } = useCatalog(auctionId);
  const viewerCount = useViewerCount(auctionId);
  const secondsLeft = useTimer(auctionId);
  const bids = useBidHistory(auctionId, item?.id || null);
  const messages = useLiveChat(auctionId);
  const [chatMessage, setChatMessage] = useState('');
  const [isAdvancing, setIsAdvancing] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-advance between rounds when timer expires
  useAutoAdvance(auctionId, true);

  const isPaused = secondsLeft < 0;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  if (liveLoading) return <LoadingSpinner size="lg" />;

  if (!auctionId || !auction) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold mb-4">פאנל הכרוז</h1>
        <p className="text-text-secondary">אין מכרז חי כרגע. הפעל מכרז מדף הניהול.</p>
      </div>
    );
  }

  const handleActivateFirstItem = async () => {
    if (!auctionId) return;
    try {
      const msg = await actions.activateNextItem(auctionId);
      toast.success(msg);
    } catch (err: any) {
      toast.error(err.message || 'שגיאה');
    }
  };

  const handleAddTime = async (seconds: number) => {
    if (!auctionId) return;
    try {
      const msg = await actions.addTime(auctionId, seconds);
      toast.success(msg);
    } catch (err: any) {
      toast.error(err.message || 'שגיאה');
    }
  };

  const handlePauseTimer = async () => {
    if (!auctionId) return;
    try {
      const msg = await actions.pauseTimer(auctionId);
      toast.success(msg);
    } catch (err: any) {
      toast.error(err.message || 'שגיאה');
    }
  };

  const handleResumeTimer = async () => {
    if (!auctionId) return;
    try {
      const msg = await actions.resumeTimer(auctionId);
      toast.success(msg);
    } catch (err: any) {
      toast.error(err.message || 'שגיאה');
    }
  };

  const advanceToNextItem = async (markAsSold: boolean) => {
    if (!auctionId || isAdvancing) return;
    setIsAdvancing(true);
    try {
      const msg = await actions.closeItemAndAdvance(auctionId, markAsSold);
      toast.success(msg);
    } catch (err: any) {
      toast.error(err.message || 'שגיאה בביצוע הפעולה');
    } finally {
      setIsAdvancing(false);
    }
  };

  const handleAdvanceRound = async () => {
    if (!auctionId || isAdvancing) return;
    setIsAdvancing(true);
    try {
      const msg = await actions.advanceRound(auctionId);
      toast.success(msg);
    } catch (err: any) {
      toast.error(err.message || 'שגיאה');
    } finally {
      setIsAdvancing(false);
    }
  };

  const handleEndAuction = async () => {
    if (!auctionId || isAdvancing) return;
    setIsAdvancing(true);
    try {
      const msg = await actions.endAuction(auctionId);
      toast.success(msg);
    } catch (err: any) {
      toast.error(err.message || 'שגיאה');
    } finally {
      setIsAdvancing(false);
    }
  };

  const sendChatMsg = async () => {
    if (!chatMessage.trim()) return;
    await push(ref(db, `live_chat/${auctionId}`), {
      senderId: user?.uid || 'auctioneer',
      senderName: profile?.displayName || 'כרוז',
      senderRole: 'auctioneer',
      message: chatMessage.trim(),
      timestamp: serverTimestamp(),
    });
    setChatMessage('');
  };

  const timerColor = isPaused ? 'orange' : getTimerColor(secondsLeft);

  // Item image
  const itemImage = item?.images?.length
    ? item.images[0]
    : item
      ? `https://placehold.co/400x250/1E1E1E/6C63FF?text=${encodeURIComponent(item.title)}`
      : null;

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="glass rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <LiveBadge />
          <h1 className="text-lg font-bold">{auction.title}</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-text-secondary">
            <span>👁</span>
            <span>{viewerCount} צופים</span>
          </div>
          <button
            onClick={handleEndAuction}
            disabled={isAdvancing}
            className="bg-timer-red/80 hover:bg-timer-red text-white px-3 py-1.5 rounded-lg text-sm disabled:opacity-50"
          >
            סיים מכרז
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Current Item with Image */}
        <div className="glass rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-semibold text-text-secondary">פריט נוכחי</h2>
          {item ? (
            <>
              {/* Vehicle image */}
              {itemImage && (
                <div className="aspect-[16/10] bg-bg-elevated rounded-lg overflow-hidden">
                  <img src={itemImage} alt={item.title} className="w-full h-full object-cover" />
                </div>
              )}

              <div className="text-xl font-bold">{item.title}</div>

              {/* Vehicle specs */}
              <div className="grid grid-cols-3 gap-1 text-xs">
                {item.year && (
                  <div className="bg-bg-elevated rounded px-2 py-1">
                    <span className="text-text-secondary">שנה: </span>{item.year}
                  </div>
                )}
                {item.km && (
                  <div className="bg-bg-elevated rounded px-2 py-1">
                    <span className="text-text-secondary">ק&quot;מ: </span>{item.km.toLocaleString()}
                  </div>
                )}
                {item.owners && (
                  <div className="bg-bg-elevated rounded px-2 py-1">
                    <span className="text-text-secondary">יד: </span>{item.owners}
                  </div>
                )}
                {item.color && (
                  <div className="bg-bg-elevated rounded px-2 py-1">
                    <span className="text-text-secondary">צבע: </span>{item.color}
                  </div>
                )}
                {item.engineCC && (
                  <div className="bg-bg-elevated rounded px-2 py-1">
                    <span className="text-text-secondary">נפח: </span>{item.engineCC}
                  </div>
                )}
                {item.make && (
                  <div className="bg-bg-elevated rounded px-2 py-1">
                    <span className="text-text-secondary">יצרן: </span>{item.make}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-text-secondary">הצעה נוכחית</div>
                  <div className="bid-amount">{formatPrice(item.currentBid)}</div>
                </div>
                <div>
                  <div className="text-xs text-text-secondary">מוביל</div>
                  <div className="font-semibold">{item.currentBidderName || '—'}</div>
                </div>
                <div>
                  <div className="text-xs text-text-secondary">סיבוב</div>
                  <div className="font-semibold">{auction.currentRound} / 3</div>
                </div>
                <div>
                  <div className="text-xs text-text-secondary">טיימר</div>
                  <div className={`font-bold text-xl ${
                    timerColor === 'green' ? 'text-timer-green' :
                    timerColor === 'orange' ? 'text-timer-orange' : 'text-timer-red'
                  }`}>
                    {formatTimer(secondsLeft)}
                  </div>
                </div>
              </div>

              {/* Recent bids */}
              <div className="mt-3 space-y-1">
                <h3 className="text-xs text-text-secondary">הצעות אחרונות</h3>
                {bids.slice(0, 5).map((bid, i) => (
                  <div key={i} className="flex justify-between text-sm bg-bg-elevated/50 rounded px-2 py-1">
                    <span className="text-text-secondary">{bid.userDisplayName}</span>
                    <span className="font-bold">{formatPrice(bid.amount)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-text-secondary mb-4">המכרז חי אך אין פריט פעיל</p>
              <button
                onClick={handleActivateFirstItem}
                className="btn-accent px-6 py-3 rounded-xl text-lg font-bold"
              >
                ▶ התחל — פריט ראשון
              </button>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="space-y-4">
          <div className="glass rounded-xl p-4 space-y-3">
            <h2 className="text-sm font-semibold text-text-secondary">בקרת טיימר</h2>
            <div className="grid grid-cols-2 gap-2">
              {isPaused ? (
                <button onClick={handleResumeTimer} className="btn bg-bid-price hover:bg-bid-price/80 text-black py-3 rounded-lg text-sm font-bold">▶ חדש טיימר</button>
              ) : (
                <button onClick={handlePauseTimer} className="btn-dark py-3 rounded-lg text-sm">⏸ עצור טיימר</button>
              )}
              <button onClick={() => handleAddTime(30)} className="btn-dark py-3 rounded-lg text-sm">+30 שנ&apos;</button>
              <button onClick={() => handleAddTime(60)} className="btn-dark py-3 rounded-lg text-sm">+60 שנ&apos;</button>
              <button onClick={() => handleAddTime(120)} className="btn-dark py-3 rounded-lg text-sm">+120 שנ&apos;</button>
            </div>
          </div>

          <div className="glass rounded-xl p-4 space-y-3">
            <h2 className="text-sm font-semibold text-text-secondary">פעולות</h2>
            <div className="space-y-2">
              {auction.currentRound < 3 && (
                <button onClick={handleAdvanceRound} disabled={isAdvancing} className="w-full btn bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg disabled:opacity-50">
                  ⏭ עבור לסיבוב {auction.currentRound + 1}
                </button>
              )}
              <button
                onClick={() => advanceToNextItem(true)}
                disabled={isAdvancing}
                className="w-full btn bg-bid-price hover:bg-bid-price/80 text-black py-3 rounded-lg font-bold disabled:opacity-50"
              >
                {isAdvancing ? 'מעבד...' : '⏭ סיים פריט + הבא (נמכר)'}
              </button>
              <button
                onClick={() => advanceToNextItem(false)}
                disabled={isAdvancing}
                className="w-full btn bg-timer-red hover:bg-timer-red/80 text-white py-3 rounded-lg disabled:opacity-50"
              >
                {isAdvancing ? 'מעבד...' : '✗ לא נמכר → הבא'}
              </button>
            </div>
          </div>
        </div>

        {/* Chat panel */}
        <div className="glass rounded-xl p-4 flex flex-col space-y-3 max-h-[600px]">
          <h2 className="text-sm font-semibold text-text-secondary">צ&apos;אט חי</h2>

          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
            {messages.map((msg, i) => (
              <div key={i} className={`text-sm rounded px-2 py-1 ${
                msg.senderRole === 'system' ? 'bg-accent/10 text-accent' :
                msg.senderRole === 'auctioneer' ? 'bg-bid-price/10 text-bid-price' :
                'bg-bg-elevated/50'
              }`}>
                <span className="font-semibold text-xs">{msg.senderName}: </span>
                <span>{msg.message}</span>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Chat input */}
          <div className="flex gap-2">
            <input
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendChatMsg()}
              placeholder="כתוב הודעה..."
              className="flex-1 bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-text-secondary focus:outline-none focus:border-accent"
            />
            <button onClick={sendChatMsg} className="btn-accent py-2 px-4 rounded-lg text-sm">
              שלח
            </button>
          </div>
        </div>
      </div>

      {/* Upcoming items */}
      <div className="glass rounded-xl p-4">
        <h2 className="text-sm font-semibold text-text-secondary mb-3">פריטים הבאים</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {items
            .filter((i) => i.status === 'pending')
            .slice(0, 6)
            .map((upItem) => (
              <div key={upItem.id} className="bg-bg-elevated rounded-lg p-3 flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-bg-surface flex items-center justify-center text-sm font-bold">
                  {upItem.order}
                </span>
                <div>
                  <div className="text-sm font-medium">{upItem.title}</div>
                  <div className="text-xs text-text-secondary">{formatPrice(upItem.openingPrice)}</div>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
