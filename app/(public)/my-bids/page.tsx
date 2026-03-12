'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ref, onValue, get, query, orderByChild, equalTo } from 'firebase/database';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import Navbar from '@/components/ui/Navbar';
import { formatPrice } from '@/lib/auction-utils';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { AuctionItem, BidHistoryEntry } from '@/lib/types';

type Tab = 'bids' | 'wins';

interface EnrichedBid {
  auctionId: string;
  auctionTitle: string;
  itemId: string;
  itemTitle: string;
  amount: number;
  round: number;
  timestamp: number;
}

interface EnrichedWin {
  auctionId: string;
  auctionTitle: string;
  itemId: string;
  itemTitle: string;
  soldPrice: number;
  status: string;
}

export default function MyBidsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('bids');
  const [bids, setBids] = useState<EnrichedBid[]>([]);
  const [wins, setWins] = useState<EnrichedWin[]>([]);
  const [loadingBids, setLoadingBids] = useState(true);
  const [loadingWins, setLoadingWins] = useState(true);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  // Fetch user's bids via registrations -> bid_history
  useEffect(() => {
    if (!user) return;

    const registrationsRef = ref(db, 'registrations');
    const unsub = onValue(registrationsRef, async (regSnap) => {
      if (!regSnap.exists()) {
        setBids([]);
        setLoadingBids(false);
        return;
      }

      const allRegs = regSnap.val() as Record<string, Record<string, any>>;
      // Find auctions where this user is registered
      const userAuctionIds: string[] = [];
      for (const [auctionId, registrations] of Object.entries(allRegs)) {
        if (registrations[user.uid]) {
          userAuctionIds.push(auctionId);
        }
      }

      if (userAuctionIds.length === 0) {
        setBids([]);
        setLoadingBids(false);
        return;
      }

      const enrichedBids: EnrichedBid[] = [];

      // For each auction, fetch auction title + bid_history
      await Promise.all(
        userAuctionIds.map(async (auctionId) => {
          try {
            const [auctionSnap, bidHistorySnap] = await Promise.all([
              get(ref(db, `auctions/${auctionId}`)),
              get(ref(db, `bid_history/${auctionId}`)),
            ]);

            const auctionTitle = auctionSnap.exists()
              ? (auctionSnap.val().title as string)
              : auctionId;

            if (!bidHistorySnap.exists()) return;

            const itemsData = bidHistorySnap.val() as Record<
              string,
              Record<string, BidHistoryEntry>
            >;

            for (const [itemId, entries] of Object.entries(itemsData)) {
              for (const entry of Object.values(entries)) {
                if (entry.userId === user.uid) {
                  // Fetch item title
                  let itemTitle = itemId;
                  try {
                    const itemSnap = await get(
                      ref(db, `auction_items/${itemId}/title`)
                    );
                    if (itemSnap.exists()) {
                      itemTitle = itemSnap.val() as string;
                    }
                  } catch {
                    // keep itemId as fallback
                  }

                  enrichedBids.push({
                    auctionId,
                    auctionTitle,
                    itemId,
                    itemTitle,
                    amount: entry.amount,
                    round: entry.round,
                    timestamp: entry.timestamp,
                  });
                }
              }
            }
          } catch {
            // skip auction on error
          }
        })
      );

      // Sort by timestamp descending (most recent first)
      enrichedBids.sort((a, b) => b.timestamp - a.timestamp);
      setBids(enrichedBids);
      setLoadingBids(false);
    });

    return () => unsub();
  }, [user]);

  // Fetch user's wins: auction_items where currentBidderId === uid AND status === 'sold'
  useEffect(() => {
    if (!user) return;

    const itemsRef = ref(db, 'auction_items');
    const unsub = onValue(itemsRef, async (snap) => {
      if (!snap.exists()) {
        setWins([]);
        setLoadingWins(false);
        return;
      }

      // Items are stored flat: auction_items/{itemId} with auctionId field
      const allItems = snap.val() as Record<string, any>;
      const enrichedWins: EnrichedWin[] = [];

      // Cache auction titles
      const auctionTitleCache: Record<string, string> = {};

      for (const [itemId, item] of Object.entries(allItems)) {
        if (item.currentBidderId === user.uid && item.status === 'sold') {
          const auctionId = item.auctionId;
          if (!auctionId) continue;
          // Fetch auction title if not cached
          if (!auctionTitleCache[auctionId]) {
            try {
              const auctionSnap = await get(ref(db, `auctions/${auctionId}/title`));
              auctionTitleCache[auctionId] = auctionSnap.exists()
                ? (auctionSnap.val() as string)
                : auctionId;
            } catch {
              auctionTitleCache[auctionId] = auctionId;
            }
          }

          enrichedWins.push({
            auctionId,
            auctionTitle: auctionTitleCache[auctionId],
            itemId,
            itemTitle: item.title,
            soldPrice: item.soldPrice || item.currentBid,
            status: item.status,
          });
        }
      }

      setWins(enrichedWins);
      setLoadingWins(false);
    });

    return () => unsub();
  }, [user]);

  if (authLoading) {
    return (
      <>
        <Navbar />
        <LoadingSpinner size="lg" />
      </>
    );
  }

  if (!user) return null;

  const isLoading = activeTab === 'bids' ? loadingBids : loadingWins;

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="glass rounded-xl p-6">
          <h1 className="text-2xl font-bold">ההצעות והזכיות שלי</h1>
          <p className="text-text-secondary mt-1">מעקב אחר כל ההצעות והזכיות שלך במכרזים</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('bids')}
            className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-smooth text-center ${
              activeTab === 'bids'
                ? 'btn-accent'
                : 'glass border border-border text-text-secondary hover:text-white'
            }`}
          >
            הצעות שלי ({loadingBids ? '...' : bids.length})
          </button>
          <button
            onClick={() => setActiveTab('wins')}
            className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-smooth text-center ${
              activeTab === 'wins'
                ? 'btn-accent'
                : 'glass border border-border text-text-secondary hover:text-white'
            }`}
          >
            זכיות שלי ({loadingWins ? '...' : wins.length})
          </button>
        </div>

        {/* Content */}
        {isLoading ? (
          <LoadingSpinner size="lg" />
        ) : activeTab === 'bids' ? (
          <BidsSection bids={bids} />
        ) : (
          <WinsSection wins={wins} />
        )}
      </div>
    </div>
  );
}

function BidsSection({ bids }: { bids: EnrichedBid[] }) {
  if (bids.length === 0) {
    return (
      <div className="glass rounded-xl p-10 text-center">
        <p className="text-text-secondary text-lg">עדיין לא הגשת הצעות</p>
        <p className="text-text-secondary text-sm mt-2">הצעות שתגיש במכרזים יופיעו כאן</p>
      </div>
    );
  }

  return (
    <div className="glass rounded-xl p-6">
      <h2 className="font-bold mb-4">הצעות שלי ({bids.length})</h2>
      <div className="space-y-2">
        {bids.map((bid, index) => (
          <div
            key={`${bid.auctionId}-${bid.itemId}-${bid.timestamp}-${index}`}
            className="bg-bg-elevated rounded-lg p-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-accent/20 text-accent flex items-center justify-center text-sm font-bold">
                {bid.round}
              </span>
              <div>
                <div className="font-semibold">{bid.itemTitle}</div>
                <div className="text-xs text-text-secondary">{bid.auctionTitle}</div>
                <div className="text-xs text-text-secondary mt-0.5">
                  {new Date(bid.timestamp).toLocaleDateString('he-IL')}{' '}
                  {new Date(bid.timestamp).toLocaleTimeString('he-IL', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {' '}
                  <span className="text-accent/60">סבב {bid.round}</span>
                </div>
              </div>
            </div>
            <div className="font-bold text-bid-price text-lg">
              {formatPrice(bid.amount)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WinsSection({ wins }: { wins: EnrichedWin[] }) {
  if (wins.length === 0) {
    return (
      <div className="glass rounded-xl p-10 text-center">
        <p className="text-text-secondary text-lg">עדיין אין זכיות</p>
        <p className="text-text-secondary text-sm mt-2">פריטים שתזכה בהם במכרזים יופיעו כאן</p>
      </div>
    );
  }

  const totalSpent = wins.reduce((sum, w) => sum + w.soldPrice, 0);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="glass rounded-xl p-4 text-center">
          <div className="text-2xl font-black text-bid-price">{wins.length}</div>
          <div className="text-sm text-text-secondary mt-1">פריטים שנרכשו</div>
        </div>
        <div className="glass rounded-xl p-4 text-center">
          <div className="text-2xl font-black text-accent">{formatPrice(totalSpent)}</div>
          <div className="text-sm text-text-secondary mt-1">סה&quot;כ שולם</div>
        </div>
      </div>

      {/* Wins list */}
      <div className="glass rounded-xl p-6">
        <h2 className="font-bold mb-4 text-bid-price">זכיות שלי ({wins.length})</h2>
        <div className="space-y-2">
          {wins.map((win) => (
            <div
              key={`${win.auctionId}-${win.itemId}`}
              className="bg-bg-elevated rounded-lg p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-bid-price/20 text-bid-price flex items-center justify-center text-xs font-bold">
                  &#10003;
                </span>
                <div>
                  <div className="font-semibold">{win.itemTitle}</div>
                  <div className="text-xs text-text-secondary">{win.auctionTitle}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs px-2 py-1 rounded-full bg-bid-price/20 text-bid-price font-semibold">
                  נמכר
                </span>
                <div className="font-bold text-bid-price text-lg">
                  {formatPrice(win.soldPrice)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
