'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { ref, onValue, query, limitToLast, orderByChild, equalTo, get } from 'firebase/database';
import { db } from './firebase';
import { Auction, AuctionItem, BidHistoryEntry, ChatMessage } from './types';

export function useAuction(auctionId: string | null) {
  const [auction, setAuction] = useState<Auction | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auctionId) { setLoading(false); return; }
    const auctionRef = ref(db, `auctions/${auctionId}`);
    const unsub = onValue(auctionRef, (snap) => {
      if (snap.exists()) {
        setAuction({ ...snap.val(), id: auctionId });
      } else {
        setAuction(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [auctionId]);

  return { auction, loading };
}

export function useLiveAuction() {
  const [auctionId, setAuctionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auctionsRef = ref(db, 'auctions');
    const unsub = onValue(auctionsRef, (snap) => {
      if (snap.exists()) {
        const auctions = snap.val();
        const liveId = Object.keys(auctions).find(
          (k) => auctions[k].status === 'live'
        );
        setAuctionId(liveId || null);
      } else {
        setAuctionId(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return { auctionId, loading };
}

export function useCurrentItem(auctionId: string | null) {
  const { auction } = useAuction(auctionId);
  const [item, setItem] = useState<AuctionItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auction?.currentItemId) {
      setItem(null);
      setLoading(false);
      return;
    }
    const itemRef = ref(db, `auction_items/${auction.currentItemId}`);
    const unsub = onValue(itemRef, (snap) => {
      if (snap.exists()) {
        setItem({ ...snap.val(), id: auction.currentItemId });
      } else {
        setItem(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [auction?.currentItemId]);

  return { item, auction, loading };
}

export function useBidHistory(auctionId: string | null, itemId: string | null) {
  const [bids, setBids] = useState<BidHistoryEntry[]>([]);

  useEffect(() => {
    if (!auctionId || !itemId) { setBids([]); return; }
    const bidsRef = query(
      ref(db, `bid_history/${auctionId}/${itemId}`),
      limitToLast(20)
    );
    const unsub = onValue(bidsRef, (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        const list = Object.values(data) as BidHistoryEntry[];
        list.sort((a, b) => b.timestamp - a.timestamp);
        setBids(list);
      } else {
        setBids([]);
      }
    });
    return () => unsub();
  }, [auctionId, itemId]);

  return bids;
}

export function useLiveChat(auctionId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (!auctionId) { setMessages([]); return; }
    const chatRef = query(
      ref(db, `live_chat/${auctionId}`),
      limitToLast(50)
    );
    const unsub = onValue(chatRef, (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        const list = Object.values(data) as ChatMessage[];
        list.sort((a, b) => a.timestamp - b.timestamp);
        setMessages(list);
      } else {
        setMessages([]);
      }
    });
    return () => unsub();
  }, [auctionId]);

  return messages;
}

export function useCatalog(auctionId: string | null) {
  const [items, setItems] = useState<AuctionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auctionId) { setItems([]); setLoading(false); return; }

    const itemsQuery = query(
      ref(db, 'auction_items'),
      orderByChild('auctionId'),
      equalTo(auctionId)
    );

    const unsub = onValue(itemsQuery, (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        const list = Object.entries(data)
          .map(([k, v]: [string, any]) => ({ ...v, id: k })) as AuctionItem[];
        list.sort((a, b) => a.order - b.order);
        setItems(list);
      } else {
        setItems([]);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [auctionId]);

  return { items, loading };
}

export function useViewerCount(auctionId: string | null) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!auctionId) return;
    const presenceRef = ref(db, `presence/${auctionId}`);
    const unsub = onValue(presenceRef, (snap) => {
      setCount(snap.exists() ? Object.keys(snap.val()).length : 0);
    });
    return () => unsub();
  }, [auctionId]);

  return count;
}

export function useTimer(auctionId: string | null) {
  const { auction } = useAuction(auctionId);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    // Return -1 to signal "paused" state
    if (auction?.timerPaused) {
      setSecondsLeft(-1);
      return;
    }

    if (!auction?.timerEndsAt) { setSecondsLeft(0); return; }

    const tick = () => {
      const remaining = Math.max(0, (auction.timerEndsAt - Date.now()) / 1000);
      setSecondsLeft(remaining);
    };

    tick();
    const interval = setInterval(tick, 100);
    return () => clearInterval(interval);
  }, [auction?.timerEndsAt, auction?.timerPaused]);

  return secondsLeft;
}

export function useAllAuctions() {
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auctionsRef = ref(db, 'auctions');
    const unsub = onValue(auctionsRef, (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        const list = Object.entries(data).map(([k, v]: [string, any]) => ({
          ...v,
          id: k,
        })) as Auction[];
        list.sort((a, b) => b.scheduledAt - a.scheduledAt);
        setAuctions(list);
      } else {
        setAuctions([]);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return { auctions, loading };
}

export function useAutoAdvance(auctionId: string | null, isAdmin: boolean) {
  const { auction } = useAuction(auctionId);
  const [processing, setProcessing] = useState(false);
  const processingRef = useRef(false);
  // Track last timerEndsAt we processed to avoid re-firing for the same expiry
  const lastProcessedRef = useRef<number | null>(null);

  useEffect(() => {
    if (!auctionId || !auction || !isAdmin) return;
    if (auction.status !== 'live') return;
    if (auction.timerPaused) return;
    if (!auction.timerEndsAt) return;

    // Skip if we already processed this exact timerEndsAt value
    if (lastProcessedRef.current === auction.timerEndsAt) return;

    const remaining = auction.timerEndsAt - Date.now();

    const fireExpiry = () => {
      if (processingRef.current) return;
      processingRef.current = true;
      lastProcessedRef.current = auction.timerEndsAt;
      setProcessing(true);
      import('./auction-actions').then(({ handleTimerExpiry }) => {
        handleTimerExpiry(auctionId).finally(() => {
          setTimeout(() => {
            processingRef.current = false;
            setProcessing(false);
          }, 3000);
        });
      });
    };

    if (remaining <= 0) {
      fireExpiry();
      return;
    }

    const timeout = setTimeout(fireExpiry, remaining + 500); // +500ms buffer to let CF act first
    return () => clearTimeout(timeout);
  }, [auctionId, auction?.timerEndsAt, auction?.status, auction?.timerPaused, isAdmin, processing]);
}

// Countdown to scheduled start time + auto-resume when countdown ends
export function useScheduledCountdown(auctionId: string | null, isAdmin: boolean) {
  const { auction } = useAuction(auctionId);
  const [countdown, setCountdown] = useState<number | null>(null);
  const autoStartedRef = useRef(false);

  useEffect(() => {
    if (!auction || auction.status !== 'live') {
      setCountdown(null);
      return;
    }
    if (!auction.waitingForScheduledStart) {
      setCountdown(null);
      return;
    }
    if (!auction.scheduledAt) {
      setCountdown(null);
      return;
    }

    const tick = () => {
      const remaining = Math.max(0, (auction.scheduledAt - Date.now()) / 1000);
      setCountdown(remaining);

      // Auto-start when countdown reaches 0 (admin only)
      if (remaining <= 0 && isAdmin && !autoStartedRef.current) {
        autoStartedRef.current = true;
        import('./auction-actions').then(({ resumeTimer }) => {
          // Resume the timer and clear the waiting flag
          import('firebase/database').then(({ ref, update }) => {
            import('./firebase').then(({ db }) => {
              update(ref(db, `auctions/${auctionId}`), {
                waitingForScheduledStart: false,
                timerPaused: false,
                timerEndsAt: Date.now() + (auction.timerDuration || 45) * 1000,
                itemStartedAt: Date.now(),
              });
            });
          });
        });
      }
    };

    tick();
    const interval = setInterval(tick, 100);
    return () => clearInterval(interval);
  }, [auction?.status, auction?.waitingForScheduledStart, auction?.scheduledAt, auctionId, isAdmin]);

  // Reset autoStarted when auctionId changes
  useEffect(() => {
    autoStartedRef.current = false;
  }, [auctionId]);

  return countdown;
}

export function useRegistration(auctionId: string | null, userId: string | null, autoRegister?: boolean, verificationStatus?: string) {
  const [registered, setRegistered] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auctionId || !userId) { setRegistered(false); setLoading(false); return; }
    const regRef = ref(db, `registrations/${auctionId}/${userId}`);
    const unsub = onValue(regRef, async (snap) => {
      if (snap.exists()) {
        setRegistered(true);
      } else if (autoRegister && verificationStatus === 'approved') {
        // Auto-register approved users for the auction
        try {
          const { set, serverTimestamp } = await import('firebase/database');
          await set(regRef, {
            userId,
            registeredAt: serverTimestamp(),
            status: 'auto',
            termsAcceptedAt: serverTimestamp(),
          });
          // onValue will fire again with snap.exists() === true
        } catch {
          setRegistered(false);
        }
      } else {
        setRegistered(false);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [auctionId, userId, autoRegister, verificationStatus]);

  return { registered, loading };
}
