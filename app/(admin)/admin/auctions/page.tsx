'use client';

import Link from 'next/link';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useAllAuctions } from '@/lib/hooks';
import Navbar from '@/components/ui/Navbar';
import { AuctionStatusBadge } from '@/components/ui/StatusBadge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import toast from 'react-hot-toast';

export default function AdminAuctionsPage() {
  const { auctions, loading } = useAllAuctions();

  const goLive = async (auctionId: string) => {
    try {
      const fn = httpsCallable(getFunctions(), 'startAuctionLive');
      await fn({ auctionId });
      toast.success('המכרז עלה לאוויר!');
    } catch (err: any) {
      toast.error(err.message || 'שגיאה בהפעלת המכרז');
    }
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">ניהול מכרזים</h1>
          <Link href="/admin/auctions/new" className="btn-accent px-4 py-2 rounded-lg text-sm">
            + מכרז חדש
          </Link>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : (
          <div className="space-y-3">
            {auctions.map((auction) => (
              <div key={auction.id} className="glass rounded-xl p-5 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-bold">{auction.title}</span>
                    <AuctionStatusBadge status={auction.status} />
                  </div>
                  <div className="text-sm text-text-secondary">
                    {auction.houseName} • {new Date(auction.scheduledAt).toLocaleDateString('he-IL')}{' '}
                    {new Date(auction.scheduledAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div className="flex gap-2">
                  {auction.status === 'published' && (
                    <button onClick={() => goLive(auction.id)} className="bg-live-dot text-white px-3 py-1.5 rounded-lg text-sm font-semibold">
                      הפעל לייב
                    </button>
                  )}
                  <Link href={`/admin/auctions/${auction.id}`} className="btn-dark px-3 py-1.5 rounded-lg text-sm">
                    ערוך
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
