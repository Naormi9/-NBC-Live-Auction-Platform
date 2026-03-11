'use client';

import { useState, useEffect, useRef } from 'react';
import { ref, update, push, serverTimestamp, get } from 'firebase/database';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import { useCurrentItem, useLiveAuction, useAuction, useCatalog, useViewerCount, useTimer, useBidHistory, useLiveChat } from '@/lib/hooks';
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
  const autoAdvanceRef = useRef(false);

  // Auto-advance when timer expires (client-side, runs every 5s)
  // Fills the gap since Cloud Scheduler only runs every 1 minute
  useEffect(() => {
    if (!auction || auction.status !== 'live' || !item || !auctionId) return;

    const interval = setInterval(async () => {
      const now = Date.now();
      if (!auction.timerEndsAt || auction.timerEndsAt > now) return;
      if (item.status !== 'active') return;
      if (autoAdvanceRef.current) return;

      autoAdvanceRef.current = true;
      try {
        if (auction.currentRound < 3) {
          const nextRound = (auction.currentRound + 1) as 2 | 3;
          const roundKey = `round${nextRound}` as 'round2' | 'round3';
          await update(ref(db, `auctions/${auctionId}`), {
            currentRound: nextRound,
            timerEndsAt: Date.now() + auction.settings[roundKey].timerSeconds * 1000,
            timerDuration: auction.settings[roundKey].timerSeconds,
          });
          await push(ref(db, `live_chat/${auctionId}`), {
            senderId: 'system',
            senderName: 'מערכת',
            senderRole: 'system',
            message: `עוברים לסיבוב ${nextRound}`,
            timestamp: serverTimestamp(),
          });
        } else {
          // Round 3 expired — mark item and find next
          const hasBidder = item.currentBidderId !== null;
          const itemUpdate: Record<string, any> = {
            status: hasBidder && item.currentBid > 0 ? 'sold' : 'unsold',
          };
          if (hasBidder && item.currentBid > 0) {
            itemUpdate.soldAt = Date.now();
            itemUpdate.soldPrice = item.currentBid;
          }
          await update(ref(db, `auction_items/${item.id}`), itemUpdate);

          // Find next pending item
          const nextItem = items.find((i) => i.order > item.order && i.status === 'pending');
          if (nextItem) {
            await update(ref(db, `auction_items/${nextItem.id}`), {
              status: 'active',
              currentBid: nextItem.preBidPrice || nextItem.openingPrice,
            });
            await update(ref(db, `auctions/${auctionId}`), {
              currentItemId: nextItem.id,
              currentRound: 1,
              timerEndsAt: Date.now() + auction.settings.round1.timerSeconds * 1000,
              timerDuration: auction.settings.round1.timerSeconds,
            });
          } else {
            await update(ref(db, `auctions/${auctionId}`), {
              status: 'ended',
              currentItemId: null,
            });
          }
        }
      } finally {
        autoAdvanceRef.current = false;
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [auction?.timerEndsAt, auction?.currentRound, auction?.status, item?.status, item?.id, auctionId, items]);

  if (liveLoading) return <LoadingSpinner size="lg" />;

  if (!auctionId || !auction) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold mb-4">פאנל הכרוז</h1>
        <p className="text-text-secondary">אין מכרז חי כרגע. הפעל מכרז מדף הניהול.</p>
      </div>
    );
  }

  const activateFirstItem = async () => {
    const firstPending = items.find((i) => i.status === 'pending');
    if (!firstPending) {
      toast.error('אין פריטים ממתינים');
      return;
    }
    await update(ref(db, `auction_items/${firstPending.id}`), {
      status: 'active',
      currentBid: firstPending.preBidPrice || firstPending.openingPrice,
    });
    await update(ref(db, `auctions/${auctionId}`), {
      currentItemId: firstPending.id,
      currentRound: 1,
      timerEndsAt: Date.now() + auction.settings.round1.timerSeconds * 1000,
      timerDuration: auction.settings.round1.timerSeconds,
    });
    await push(ref(db, `live_chat/${auctionId}`), {
      senderId: 'system',
      senderName: 'מערכת',
      senderRole: 'system',
      message: `הפריט "${firstPending.title}" עלה לבמה!`,
      timestamp: serverTimestamp(),
    });
    toast.success(`הפריט הראשון הופעל: ${firstPending.title}`);
  };

  const addTime = async (seconds: number) => {
    const newEnd = (auction.timerEndsAt || Date.now()) + seconds * 1000;
    await update(ref(db, `auctions/${auctionId}`), { timerEndsAt: newEnd });
    toast.success(`נוספו ${seconds} שניות`);
  };

  const pauseTimer = async () => {
    await update(ref(db, `auctions/${auctionId}`), {
      timerEndsAt: Date.now() + 999999000,
    });
    toast.success('הטיימר הושהה');
  };

  const advanceToNextItem = async (markAsSold: boolean) => {
    if (!item) return;

    // Close current item
    const itemUpdate: Record<string, any> = {
      status: markAsSold && item.currentBid > 0 ? 'sold' : 'unsold',
    };
    if (markAsSold && item.currentBid > 0) {
      itemUpdate.soldAt = Date.now();
      itemUpdate.soldPrice = item.currentBid;
    }
    await update(ref(db, `auction_items/${item.id}`), itemUpdate);

    // System message
    if (markAsSold && item.currentBid > 0) {
      await push(ref(db, `live_chat/${auctionId}`), {
        senderId: 'system',
        senderName: 'מערכת',
        senderRole: 'system',
        message: `הפריט "${item.title}" נמכר ב-${formatPrice(item.currentBid)} ל-${item.currentBidderName}!`,
        timestamp: serverTimestamp(),
      });
    } else {
      await push(ref(db, `live_chat/${auctionId}`), {
        senderId: 'system',
        senderName: 'מערכת',
        senderRole: 'system',
        message: `הפריט "${item.title}" לא נמכר.`,
        timestamp: serverTimestamp(),
      });
    }

    // Find next item
    const nextItem = items.find((i) => i.order > item.order && i.status === 'pending');

    if (nextItem) {
      // Activate next item
      await update(ref(db, `auction_items/${nextItem.id}`), {
        status: 'active',
        currentBid: nextItem.preBidPrice || nextItem.openingPrice,
      });
      await update(ref(db, `auctions/${auctionId}`), {
        currentItemId: nextItem.id,
        currentRound: 1,
        timerEndsAt: Date.now() + auction.settings.round1.timerSeconds * 1000,
        timerDuration: auction.settings.round1.timerSeconds,
      });
      await push(ref(db, `live_chat/${auctionId}`), {
        senderId: 'system',
        senderName: 'מערכת',
        senderRole: 'system',
        message: `הפריט "${nextItem.title}" עלה לבמה!`,
        timestamp: serverTimestamp(),
      });
      toast.success(`עברנו לפריט: ${nextItem.title}`);
    } else {
      // No more items - end auction
      await update(ref(db, `auctions/${auctionId}`), {
        status: 'ended',
        currentItemId: null,
      });
      await push(ref(db, `live_chat/${auctionId}`), {
        senderId: 'system',
        senderName: 'מערכת',
        senderRole: 'system',
        message: 'המכרז הסתיים! תודה לכל המשתתפים.',
        timestamp: serverTimestamp(),
      });
      toast.success('המכרז הסתיים!');
    }
  };

  const advanceRound = async () => {
    if (!auction || auction.currentRound >= 3) return;
    const nextRound = (auction.currentRound + 1) as 1 | 2 | 3;
    const roundKey = `round${nextRound}` as 'round1' | 'round2' | 'round3';
    await update(ref(db, `auctions/${auctionId}`), {
      currentRound: nextRound,
      timerEndsAt: Date.now() + auction.settings[roundKey].timerSeconds * 1000,
      timerDuration: auction.settings[roundKey].timerSeconds,
    });
    await push(ref(db, `live_chat/${auctionId}`), {
      senderId: 'system',
      senderName: 'מערכת',
      senderRole: 'system',
      message: `עוברים לסיבוב ${nextRound} — מדרגת קפיצה: ${formatPrice(auction.settings[roundKey].increment)}`,
      timestamp: serverTimestamp(),
    });
    toast.success(`עברנו לסיבוב ${nextRound}`);
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

  const timerColor = getTimerColor(secondsLeft);

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-4">
      {/* Header */}
      <div className="glass rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <LiveBadge />
          <h1 className="text-lg font-bold">{auction.title}</h1>
        </div>
        <div className="flex items-center gap-2 text-text-secondary">
          <span>👁</span>
          <span>{viewerCount} צופים</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Current Item */}
        <div className="glass rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-semibold text-text-secondary">פריט נוכחי</h2>
          {item ? (
            <>
              <div className="text-xl font-bold">{item.title}</div>
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
                onClick={activateFirstItem}
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
              <button onClick={pauseTimer} className="btn-dark py-3 rounded-lg text-sm">⏸ עצור טיימר</button>
              <button onClick={() => addTime(30)} className="btn-dark py-3 rounded-lg text-sm">+30 שנ&apos;</button>
              <button onClick={() => addTime(60)} className="btn-dark py-3 rounded-lg text-sm">+60 שנ&apos;</button>
              <button onClick={() => addTime(120)} className="btn-dark py-3 rounded-lg text-sm">+120 שנ&apos;</button>
            </div>
          </div>

          <div className="glass rounded-xl p-4 space-y-3">
            <h2 className="text-sm font-semibold text-text-secondary">פעולות</h2>
            <div className="space-y-2">
              {auction.currentRound < 3 && (
                <button onClick={advanceRound} className="w-full btn bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg">
                  ⏭ עבור לסיבוב {auction.currentRound + 1}
                </button>
              )}
              <button
                onClick={() => advanceToNextItem(true)}
                className="w-full btn bg-bid-price hover:bg-bid-price/80 text-black py-3 rounded-lg font-bold"
              >
                ⏭ סיים פריט + הבא (נמכר)
              </button>
              <button
                onClick={() => advanceToNextItem(false)}
                className="w-full btn bg-timer-red hover:bg-timer-red/80 text-white py-3 rounded-lg"
              >
                ✗ לא נמכר → הבא
              </button>
            </div>
          </div>

          {/* Chat broadcast */}
          <div className="glass rounded-xl p-4 space-y-3">
            <h2 className="text-sm font-semibold text-text-secondary">שלח הודעה למשתתפים</h2>
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
