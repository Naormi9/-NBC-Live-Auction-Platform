'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { ref, set, serverTimestamp } from 'firebase/database';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import { useAuction, useCatalog, useRegistration } from '@/lib/hooks';
import Navbar from '@/components/ui/Navbar';
import { AuctionStatusBadge, ItemStatusBadge } from '@/components/ui/StatusBadge';
import { formatPrice } from '@/lib/auction-utils';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import toast from 'react-hot-toast';

export default function AuctionCatalogPage() {
  const params = useParams();
  const auctionId = params.id as string;
  const { auction, loading: auctionLoading } = useAuction(auctionId);
  const { items, loading: itemsLoading } = useCatalog(auctionId);
  const { user } = useAuth();
  const { registered } = useRegistration(auctionId, user?.uid || null);
  const [preBidItem, setPreBidItem] = useState<string | null>(null);
  const [preBidAmount, setPreBidAmount] = useState('');

  const handleRegister = async () => {
    if (!user) {
      toast.error('התחבר קודם כדי להירשם');
      return;
    }
    await set(ref(db, `registrations/${auctionId}/${user.uid}`), {
      userId: user.uid,
      registeredAt: serverTimestamp(),
      status: 'approved',
    });
    toast.success('נרשמת למכרז בהצלחה!');
  };

  const handlePreBid = async (itemId: string) => {
    if (!user || !preBidAmount) return;
    const amount = parseInt(preBidAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('הכנס סכום תקין');
      return;
    }
    await set(ref(db, `pre_bids/${auctionId}/${itemId}/${user.uid}`), {
      userId: user.uid,
      userDisplayName: user.displayName || 'משתתף',
      amount,
      timestamp: serverTimestamp(),
    });
    toast.success(`הצעה מוקדמת של ${formatPrice(amount)} נשלחה!`);
    setPreBidItem(null);
    setPreBidAmount('');
  };

  if (auctionLoading || itemsLoading) return <><Navbar /><LoadingSpinner size="lg" /></>;

  if (!auction) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="text-center py-20 text-text-secondary">מכרז לא נמצא</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="glass rounded-xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-3">
            <AuctionStatusBadge status={auction.status} />
            <span className="text-sm text-text-secondary">
              {new Date(auction.scheduledAt).toLocaleDateString('he-IL')} בשעה{' '}
              {new Date(auction.scheduledAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <h1 className="text-2xl font-bold mb-2">{auction.title}</h1>
          <p className="text-text-secondary">{auction.houseName}</p>

          {!registered && user && (
            <button onClick={handleRegister} className="btn-accent mt-4 px-6 py-3 rounded-xl">
              הירשם למכרז זה
            </button>
          )}
          {registered && (
            <div className="mt-4 text-bid-price text-sm font-semibold">
              ✓ רשום למכרז זה
            </div>
          )}
          {!user && (
            <p className="mt-4 text-text-secondary text-sm">
              התחבר כדי להירשם למכרז
            </p>
          )}
        </div>

        {/* Items Grid */}
        <h2 className="text-lg font-bold mb-4">קטלוג — {items.length} פריטים</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <div key={item.id} className="glass rounded-xl overflow-hidden">
              {/* Image */}
              <div className="aspect-video bg-bg-elevated flex items-center justify-center">
                {item.images?.[0] ? (
                  <img src={item.images[0]} alt={item.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="text-text-secondary text-sm">{item.make} {item.model}</div>
                )}
              </div>
              <div className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-secondary">פריט {item.order}</span>
                  <ItemStatusBadge status={item.status} />
                </div>
                <h3 className="font-bold">{item.title}</h3>
                <div className="grid grid-cols-2 gap-1 text-xs text-text-secondary">
                  <span>{item.year} • {item.km?.toLocaleString()} ק&quot;מ</span>
                  <span>יד {item.owners} • {item.color}</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <span className="text-sm text-text-secondary">מחיר פתיחה</span>
                  <span className="font-bold text-bid-price">{formatPrice(item.openingPrice)}</span>
                </div>

                {/* Pre-bid button */}
                {auction.preBidsEnabled && registered && item.status === 'pending' && (
                  <>
                    {preBidItem === item.id ? (
                      <div className="flex gap-2 mt-2">
                        <input
                          type="number"
                          value={preBidAmount}
                          onChange={(e) => setPreBidAmount(e.target.value)}
                          placeholder="סכום הצעה"
                          className="flex-1 bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
                          dir="ltr"
                        />
                        <button
                          onClick={() => handlePreBid(item.id)}
                          className="btn-accent px-3 py-2 rounded-lg text-sm"
                        >
                          שלח
                        </button>
                        <button
                          onClick={() => setPreBidItem(null)}
                          className="btn-dark px-3 py-2 rounded-lg text-sm"
                        >
                          ✗
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setPreBidItem(item.id)}
                        className="w-full btn-dark py-2 rounded-lg text-sm mt-2"
                      >
                        הצעה מוקדמת
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
