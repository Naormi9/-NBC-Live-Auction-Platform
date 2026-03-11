'use client';

import { useEffect, useState, useCallback } from 'react';
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
    const countRef = ref(db, `auctions/${auctionId}/viewerCount`);
    const unsub = onValue(countRef, (snap) => {
      setCount(snap.val() || 0);
    });
    return () => unsub();
  }, [auctionId]);

  return count;
}

export function useTimer(auctionId: string | null) {
  const { auction } = useAuction(auctionId);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!auction?.timerEndsAt) { setSecondsLeft(0); return; }

    const tick = () => {
      const remaining = Math.max(0, (auction.timerEndsAt - Date.now()) / 1000);
      setSecondsLeft(remaining);
    };

    tick();
    const interval = setInterval(tick, 100);
    return () => clearInterval(interval);
  }, [auction?.timerEndsAt]);

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

export function useRegistration(auctionId: string | null, userId: string | null) {
  const [registered, setRegistered] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auctionId || !userId) { setRegistered(false); setLoading(false); return; }
    const regRef = ref(db, `registrations/${auctionId}/${userId}`);
    const unsub = onValue(regRef, (snap) => {
      setRegistered(snap.exists());
      setLoading(false);
    });
    return () => unsub();
  }, [auctionId, userId]);

  return { registered, loading };
}
