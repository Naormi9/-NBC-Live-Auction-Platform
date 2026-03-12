'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { ref, set, onValue, serverTimestamp } from 'firebase/database';
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
  const [termsAccepted, setTermsAccepted] = useState(false);
  // Track user's existing pre-bids: { [itemId]: amount }
  const [userPreBids, setUserPreBids] = useState<Record<string, number>>({});

  // Listen to current user's pre-bids for this auction
  useEffect(() => {
    if (!user || !auctionId) return;
    const preBidsRef = ref(db, `pre_bids/${auctionId}`);
    const unsub = onValue(preBidsRef, (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        const bids: Record<string, number> = {};
        for (const [itemId, itemBids] of Object.entries(data)) {
          const userBid = (itemBids as any)[user.uid];
          if (userBid) {
            bids[itemId] = userBid.amount;
          }
        }
        setUserPreBids(bids);
      } else {
        setUserPreBids({});
      }
    });
    return () => unsub();
  }, [user?.uid, auctionId]);

  const handleRegister = async () => {
    if (!user) {
      toast.error('התחבר קודם כדי להירשם');
      return;
    }
    if (!termsAccepted) {
      toast.error('יש לאשר את תנאי ההשתתפות');
      return;
    }
    await set(ref(db, `registrations/${auctionId}/${user.uid}`), {
      userId: user.uid,
      registeredAt: serverTimestamp(),
      status: 'approved',
      termsAcceptedAt: serverTimestamp(),
    });
    toast.success('נרשמת למכרז בהצלחה!');
  };

  const handlePreBid = async (itemId: string, item: any) => {
    if (!user || !preBidAmount || !auction) return;
    const amount = parseInt(preBidAmount);
    const openingPrice = item.openingPrice || 0;
    // Pre-bid increment from auction settings (default ₪500)
    const preBidIncrement = (auction.settings as any)?.preBidIncrement || auction.settings?.round1?.increment || 500;

    if (isNaN(amount) || amount <= 0) {
      toast.error('הכנס סכום תקין');
      return;
    }
    // Must be at least the opening price
    if (amount < openingPrice) {
      toast.error(`הצעה חייבת להיות לפחות מחיר הפתיחה (${formatPrice(openingPrice)})`);
      return;
    }
    // Must be aligned to increment steps from opening price
    if ((amount - openingPrice) % preBidIncrement !== 0) {
      toast.error(`הצעה חייבת להיות בקפיצות של ${formatPrice(preBidIncrement)} ממחיר הפתיחה`);
      return;
    }
    // Can't outbid yourself - check if this user is already the highest bidder
    const currentPreBidPrice = item.preBidPrice || 0;
    const existingBid = userPreBids[itemId];
    if (existingBid && existingBid >= currentPreBidPrice && currentPreBidPrice > 0) {
      // User is the highest bidder - can only bid if someone else outbid them
      toast.error('אינך יכול להקפיץ מעל עצמך. המתן עד שמישהו אחר יציע');
      return;
    }
    // New bid must be higher than current max pre-bid
    if (amount <= currentPreBidPrice) {
      toast.error(`הצעה חייבת להיות גבוהה מההצעה הנוכחית (${formatPrice(currentPreBidPrice)})`);
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
            <div className="mt-4 space-y-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} className="accent-accent w-4 h-4" />
                <span>אני מאשר/ת את תנאי ההשתתפות במכרז ומסכים/ה לתנאי השימוש</span>
              </label>
              <button onClick={handleRegister} disabled={!termsAccepted} className="btn-accent px-6 py-3 rounded-xl disabled:opacity-50">
                הירשם למכרז זה
              </button>
            </div>
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

                {/* Highest pre-bid (anonymous per spec) */}
                {item.preBidPrice && item.preBidPrice > item.openingPrice && (
                  <div className="flex items-center justify-between text-sm bg-bid-price/10 border border-bid-price/20 rounded-lg px-3 py-2">
                    <span className="text-text-secondary">הצעה מוקדמת גבוהה</span>
                    <span className="font-bold text-bid-price">{formatPrice(item.preBidPrice)}</span>
                  </div>
                )}

                {/* Show user's existing pre-bid */}
                {userPreBids[item.id] && (
                  <div className="flex items-center justify-between text-sm bg-accent/10 border border-accent/20 rounded-lg px-3 py-2">
                    <span className="text-text-secondary">ההצעה שלך</span>
                    <span className="font-bold text-accent">{formatPrice(userPreBids[item.id])}</span>
                  </div>
                )}

                {/* Pre-bid button */}
                {/* Pre-bid: available for pending items if preBids enabled, even during live per spec */}
                {auction.preBidsEnabled && registered && item.status === 'pending' && (
                  <>
                    {preBidItem === item.id ? (
                      <div className="flex gap-2 mt-2">
                        <input
                          type="number"
                          value={preBidAmount}
                          onChange={(e) => setPreBidAmount(e.target.value)}
                          placeholder={userPreBids[item.id] ? `מעל ${formatPrice(userPreBids[item.id])}` : 'סכום הצעה'}
                          className="flex-1 bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
                          dir="ltr"
                        />
                        <button
                          onClick={() => handlePreBid(item.id, item)}
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
                        onClick={() => { setPreBidItem(item.id); setPreBidAmount(''); }}
                        className="w-full btn-dark py-2 rounded-lg text-sm mt-2"
                      >
                        {userPreBids[item.id] ? 'עדכן הצעה מוקדמת' : 'הצעה מוקדמת'}
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
