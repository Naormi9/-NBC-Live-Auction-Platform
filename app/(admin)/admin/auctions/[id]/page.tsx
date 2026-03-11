'use client';

import { useParams } from 'next/navigation';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useAuction, useCatalog } from '@/lib/hooks';
import Navbar from '@/components/ui/Navbar';
import { AuctionStatusBadge, ItemStatusBadge } from '@/components/ui/StatusBadge';
import { formatPrice } from '@/lib/auction-utils';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import toast from 'react-hot-toast';

export default function EditAuctionPage() {
  const params = useParams();
  const auctionId = params.id as string;
  const { auction, loading: auctionLoading } = useAuction(auctionId);
  const { items, loading: itemsLoading } = useCatalog(auctionId);

  if (auctionLoading || itemsLoading) return <><Navbar /><LoadingSpinner size="lg" /></>;
  if (!auction) return <><Navbar /><div className="text-center py-20 text-text-secondary">מכרז לא נמצא</div></>;

  const startLive = async () => {
    try {
      const fn = httpsCallable(getFunctions(), 'startAuctionLive');
      await fn({ auctionId });
      toast.success('המכרז התחיל!');
    } catch (err: any) {
      toast.error(err.message || 'שגיאה בהפעלת המכרז');
    }
  };

  const handleEndAuction = async () => {
    try {
      const fn = httpsCallable(getFunctions(), 'endAuction');
      await fn({ auctionId });
      toast.success('המכרז הסתיים');
    } catch (err: any) {
      toast.error(err.message || 'שגיאה בסיום המכרז');
    }
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="glass rounded-xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <AuctionStatusBadge status={auction.status} />
            <h1 className="text-2xl font-bold">{auction.title}</h1>
          </div>
          <p className="text-text-secondary">{auction.houseName}</p>
          <p className="text-sm text-text-secondary mt-1">
            {new Date(auction.scheduledAt).toLocaleDateString('he-IL')} בשעה{' '}
            {new Date(auction.scheduledAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
          </p>

          <div className="flex gap-3 mt-4">
            {auction.status === 'published' && (
              <button onClick={startLive} className="bg-live-dot text-white px-4 py-2 rounded-lg font-semibold text-sm">
                התחל מכרז חי
              </button>
            )}
            {auction.status === 'live' && (
              <button onClick={handleEndAuction} className="bg-timer-red text-white px-4 py-2 rounded-lg font-semibold text-sm">
                סיים מכרז
              </button>
            )}
          </div>
        </div>

        {/* Items */}
        <div className="glass rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold">פריטים ({items.length})</h2>
          </div>
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="bg-bg-elevated rounded-lg p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-bg-surface flex items-center justify-center text-sm font-bold">
                    {item.order}
                  </span>
                  <div>
                    <div className="font-semibold">{item.title}</div>
                    <div className="text-sm text-text-secondary">
                      {item.year} • {item.km?.toLocaleString()} ק&quot;מ • פתיחה: {formatPrice(item.openingPrice)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <ItemStatusBadge status={item.status} />
                  {item.soldPrice && (
                    <span className="text-bid-price font-bold">{formatPrice(item.soldPrice)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
