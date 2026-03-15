'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { ref, push, update, serverTimestamp, onValue } from 'firebase/database';
import { db, auth as firebaseAuth } from '@/lib/firebase';
import * as actions from '@/lib/auction-actions';
import { updateLiveSettings, setTimerOverride } from '@/lib/auction-actions';
import { useAuth } from '@/lib/auth-context';
import { isAllowedAdmin } from '@/lib/admin-allowlist';
import { useCurrentItem, useLiveAuction, useAuction, useCatalog, useViewerCount, useTimer, useBidHistory, useLiveChat, useAutoAdvance } from '@/lib/hooks';
import { formatPrice, formatTimer, getTimerColor } from '@/lib/auction-utils';
import LiveBadge from '../ui/LiveBadge';
import LoadingSpinner from '../ui/LoadingSpinner';
import toast from 'react-hot-toast';
import type { VerificationStatus } from '@/lib/types';

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
  const [showSettings, setShowSettings] = useState(false);
  const [editRound, setEditRound] = useState<'round1' | 'round2' | 'round3'>('round1');
  const [editIncrement, setEditIncrement] = useState('');
  const [editTimer, setEditTimer] = useState('');
  const [overrideSeconds, setOverrideSeconds] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [showParticipants, setShowParticipants] = useState(false);
  const [participants, setParticipants] = useState<any[]>([]);
  const [participantCount, setParticipantCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const prevPendingCountRef = useRef(0);
  const [updatingUid, setUpdatingUid] = useState<string | null>(null);

  // Auto-advance between rounds when timer expires
  useAutoAdvance(auctionId, true);

  const isPaused = secondsLeft < 0;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Real-time participants listener for admin
  useEffect(() => {
    const usersRef = ref(db, 'users');
    const unsub = onValue(usersRef, (snap) => {
      if (!snap.exists()) { setParticipants([]); setParticipantCount(0); setPendingCount(0); return; }
      const data = snap.val();
      const list = Object.entries(data)
        .map(([uid, val]: [string, any]) => ({ uid, ...val }))
        .filter((u: any) => !isAllowedAdmin(u.email))
        .sort((a: any, b: any) => {
          const order: Record<string, number> = { pending_approval: 0, pending_verification: 1, rejected: 2, approved: 3 };
          return (order[a.verificationStatus] ?? 9) - (order[b.verificationStatus] ?? 9);
        });
      setParticipants(list);
      setParticipantCount(list.length);
      const newPending = list.filter((u: any) => u.verificationStatus === 'pending_approval' || u.verificationStatus === 'pending_verification').length;
      // Notify when new pending users arrive
      if (newPending > prevPendingCountRef.current && prevPendingCountRef.current >= 0) {
        const diff = newPending - prevPendingCountRef.current;
        if (prevPendingCountRef.current > 0) {
          toast(`${diff} נרשמים חדשים ממתינים לאישור`, { icon: '🔔' });
        }
      }
      prevPendingCountRef.current = newPending;
      setPendingCount(newPending);
    });
    return () => unsub();
  }, []);

  const handleApproveUser = async (uid: string) => {
    if (!firebaseAuth.currentUser) return;
    setUpdatingUid(uid);
    try {
      const token = await firebaseAuth.currentUser.getIdToken();
      const res = await fetch('/api/admin/update-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ targetUid: uid, newStatus: 'approved' }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success('אושר');
    } catch {
      toast.error('שגיאה באישור');
    } finally {
      setUpdatingUid(null);
    }
  };

  const handleRejectUser = async (uid: string) => {
    if (!firebaseAuth.currentUser) return;
    setUpdatingUid(uid);
    try {
      const token = await firebaseAuth.currentUser.getIdToken();
      const res = await fetch('/api/admin/update-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ targetUid: uid, newStatus: 'rejected' }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success('נדחה');
    } catch {
      toast.error('שגיאה');
    } finally {
      setUpdatingUid(null);
    }
  };

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
    if (!chatMessage.trim() || !user) return;
    await push(ref(db, `live_chat/${auctionId}`), {
      senderId: user.uid,
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
      ? `https://placehold.co/400x250/1A1F2E/433BFF?text=${encodeURIComponent(item.title)}`
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
                  <div key={`bid-${bid.userId}-${bid.amount}`} className="flex justify-between text-sm bg-bg-elevated/50 rounded px-2 py-1">
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

          {/* Settings Editor */}
          <div className="glass rounded-xl p-4 space-y-3">
            <button
              onClick={() => {
                setShowSettings(!showSettings);
                if (!showSettings && auction?.settings) {
                  const rk = editRound;
                  const s = auction.settings as any;
                  setEditIncrement(String(s?.[rk]?.increment || ''));
                  setEditTimer(String(s?.[rk]?.timerSeconds || ''));
                }
              }}
              className="w-full flex items-center justify-between text-sm font-semibold text-text-secondary"
            >
              <span>הגדרות סיבובים</span>
              <span>{showSettings ? '▲' : '▼'}</span>
            </button>
            {showSettings && (
              <div className="space-y-3">
                {/* Fixed timer override */}
                <div className="bg-bg-elevated/50 rounded-lg p-3 space-y-2">
                  <label className="text-xs text-text-secondary">טיימר קבוע למכרז (שניות) — דורס הגדרות סיבובים</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={overrideSeconds}
                      onChange={(e) => setOverrideSeconds(e.target.value)}
                      placeholder={auction?.settings?.timerOverrideSeconds ? String(auction.settings.timerOverrideSeconds) : 'לא הוגדר'}
                      className="flex-1 bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
                      dir="ltr"
                    />
                    <button
                      onClick={async () => {
                        if (!auctionId) return;
                        const sec = parseInt(overrideSeconds);
                        if (isNaN(sec) || sec <= 0) {
                          toast.error('הזן מספר שניות תקין');
                          return;
                        }
                        try {
                          const msg = await setTimerOverride(auctionId, sec);
                          toast.success(msg);
                          setOverrideSeconds('');
                        } catch (err: any) {
                          toast.error(err.message || 'שגיאה');
                        }
                      }}
                      className="btn-accent py-2 px-4 rounded-lg text-xs font-bold"
                    >
                      קבע
                    </button>
                    {auction?.settings?.timerOverrideSeconds && (
                      <button
                        onClick={async () => {
                          if (!auctionId) return;
                          try {
                            const msg = await setTimerOverride(auctionId, null);
                            toast.success(msg);
                          } catch (err: any) {
                            toast.error(err.message || 'שגיאה');
                          }
                        }}
                        className="btn-dark py-2 px-3 rounded-lg text-xs"
                      >
                        בטל
                      </button>
                    )}
                  </div>
                  {auction?.settings?.timerOverrideSeconds && (
                    <div className="text-xs text-accent">פעיל: {auction.settings.timerOverrideSeconds} שניות קבוע</div>
                  )}
                </div>

                <div className="flex gap-2">
                  {(['round1', 'round2', 'round3'] as const).map((rk) => (
                    <button
                      key={rk}
                      onClick={() => {
                        setEditRound(rk);
                        const s = auction?.settings as any;
                        setEditIncrement(String(s?.[rk]?.increment || ''));
                        setEditTimer(String(s?.[rk]?.timerSeconds || ''));
                      }}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold ${
                        editRound === rk ? 'bg-accent text-black' : 'btn-dark'
                      }`}
                    >
                      {rk === 'round1' ? 'סיבוב 1' : rk === 'round2' ? 'סיבוב 2' : 'סיבוב 3'}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-text-secondary">מדרגת קפיצה (₪)</label>
                    <input
                      type="number"
                      value={editIncrement}
                      onChange={(e) => setEditIncrement(e.target.value)}
                      className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-text-secondary">טיימר (שניות)</label>
                    <input
                      type="number"
                      value={editTimer}
                      onChange={(e) => setEditTimer(e.target.value)}
                      className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
                      dir="ltr"
                    />
                  </div>
                </div>
                <button
                  onClick={async () => {
                    if (!auctionId) return;
                    const inc = parseInt(editIncrement);
                    const timer = parseInt(editTimer);
                    if (isNaN(inc) || isNaN(timer) || inc <= 0 || timer <= 0) {
                      toast.error('ערכים לא תקינים');
                      return;
                    }
                    try {
                      const msg = await updateLiveSettings(auctionId, editRound, inc, timer);
                      toast.success(msg);
                    } catch (err: any) {
                      toast.error(err.message || 'שגיאה');
                    }
                  }}
                  className="w-full btn-accent py-2 rounded-lg text-sm font-bold"
                >
                  שמור הגדרות {editRound === 'round1' ? 'סיבוב 1' : editRound === 'round2' ? 'סיבוב 2' : 'סיבוב 3'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Chat panel */}
        <div className="glass rounded-xl p-4 flex flex-col space-y-3 max-h-[600px]">
          <h2 className="text-sm font-semibold text-text-secondary">צ&apos;אט חי</h2>

          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
            {messages.map((msg, i) => (
              <div key={`msg-${msg.senderId}-${msg.timestamp}-${i}`} className={`text-sm rounded px-2 py-1 ${
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

      {/* Floating Participants Button */}
      <button
        onClick={() => setShowParticipants(!showParticipants)}
        className="fixed bottom-6 left-6 z-50 w-14 h-14 rounded-full bg-accent hover:bg-accent/80 text-white shadow-lg flex items-center justify-center transition-smooth"
      >
        <span className="text-xl">👥</span>
        {pendingCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-timer-red text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold animate-pulse">
            {pendingCount}
          </span>
        )}
      </button>

      {/* Floating Participants Drawer */}
      {showParticipants && (
        <div className="fixed inset-y-0 left-0 z-50 w-80 bg-bg-primary/95 backdrop-blur-xl border-r border-border shadow-2xl flex flex-col">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="font-bold text-sm">משתתפים ({participantCount})</h2>
            <button onClick={() => setShowParticipants(false)} className="text-text-secondary hover:text-white text-lg">✕</button>
          </div>
          {pendingCount > 0 && (
            <div className="px-4 py-2 bg-orange-500/10 border-b border-border text-xs text-orange-400 font-medium">
              {pendingCount} ממתינים לאישור
            </div>
          )}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {participants.map((p) => {
              const isPending = p.verificationStatus === 'pending_approval' || p.verificationStatus === 'pending_verification';
              const isApproved = p.verificationStatus === 'approved';
              const isRejected = p.verificationStatus === 'rejected';
              const isUpdating = updatingUid === p.uid;
              return (
                <div key={p.uid} className={`rounded-lg p-2 text-xs ${isPending ? 'bg-orange-500/10 border border-orange-500/20' : 'bg-bg-elevated/50'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-bold truncate">{p.displayName || 'ללא שם'}</div>
                      <div className="text-text-secondary truncate">{p.phone || p.email}</div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {isApproved && <span className="text-green-400 text-[10px] font-bold">✓</span>}
                      {isRejected && <span className="text-red-400 text-[10px] font-bold">✗</span>}
                      {!isApproved && (
                        <button
                          onClick={() => handleApproveUser(p.uid)}
                          disabled={isUpdating}
                          className="px-2 py-0.5 bg-green-600 hover:bg-green-700 text-white rounded text-[10px] font-bold disabled:opacity-50"
                        >
                          {isUpdating ? '...' : 'אשר'}
                        </button>
                      )}
                      {isPending && (
                        <button
                          onClick={() => handleRejectUser(p.uid)}
                          disabled={isUpdating}
                          className="px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-bold disabled:opacity-50"
                        >
                          דחה
                        </button>
                      )}
                    </div>
                  </div>
                  {p.callbackRequested && (
                    <div className="mt-1 text-blue-400 text-[10px]">📞 ביקש חזרה טלפונית</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
