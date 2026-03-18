'use client';

import Link from 'next/link';
import { startAuctionLive, deleteAuction } from '@/lib/auction-actions';
import { useAllAuctions } from '@/lib/hooks';
import { useAuth } from '@/lib/auth-context';
import Navbar from '@/components/ui/Navbar';
import { AuctionStatusBadge } from '@/components/ui/StatusBadge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import toast from 'react-hot-toast';

export default function AdminAuctionsPage() {
  const { auctions: allAuctions, loading } = useAllAuctions();
  const { profile } = useAuth();

  // House managers only see their own auctions
  const auctions = profile?.role === 'house_manager' && profile.houseId
    ? allAuctions.filter((a) => a.houseId === profile.houseId)
    : allAuctions;

  const goLive = async (auctionId: string) => {
    try {
      const msg = await startAuctionLive(auctionId);
      toast.success(msg);
    } catch (err: any) {
      toast.error(err.message || 'שגיאה בהפעלת המכרז');
    }
  };

  const handleDelete = async (auctionId: string, title: string) => {
    if (!window.confirm(`למחוק את המכרז "${title}"?\nפעולה זו תמחק את כל הפריטים, ההצעות והצ׳אט. לא ניתן לבטל.`)) {
      return;
    }
    try {
      const msg = await deleteAuction(auctionId);
      toast.success(msg);
    } catch (err: any) {
      toast.error(err.message || 'שגיאה במחיקת המכרז');
    }
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">ניהול מכרזים</h1>
          <Link href="/admin/auctions/new" className="bg-accent hover:bg-accent-hover text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-smooth">
            + מכרז חדש
          </Link>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : auctions.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3 opacity-40">📋</div>
            <p className="text-text-secondary">אין מכרזים עדיין</p>
          </div>
        ) : (
          <div className="space-y-3">
            {auctions.map((auction) => (
              <div key={auction.id} className="glass rounded-2xl p-5 flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-bold text-lg truncate">{auction.title}</span>
                    <AuctionStatusBadge status={auction.status} />
                  </div>
                  <div className="text-sm text-text-secondary truncate">
                    {auction.houseName} • {new Date(auction.scheduledAt).toLocaleDateString('he-IL')}{' '}
                    {new Date(auction.scheduledAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {(auction.status === 'published' || auction.status === 'draft') && (
                    <button onClick={() => goLive(auction.id)} className="bg-live-dot hover:bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-smooth">
                      הפעל לייב
                    </button>
                  )}
                  {auction.status === 'live' && (
                    <Link href="/admin/live" className="bg-live-dot hover:bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-semibold animate-pulse transition-smooth">
                      פאנל כרוז
                    </Link>
                  )}
                  {auction.status === 'ended' && (
                    <Link href={`/auctions/${auction.id}/results`} className="bg-bg-elevated hover:bg-bg-surface text-white border border-border px-4 py-2 rounded-xl text-sm transition-smooth">
                      תוצאות
                    </Link>
                  )}
                  <Link href={`/admin/auctions/${auction.id}`} className="bg-bg-elevated hover:bg-bg-surface text-white border border-border px-4 py-2 rounded-xl text-sm transition-smooth">
                    ערוך
                  </Link>
                  {auction.status !== 'live' && (
                    <button
                      onClick={() => handleDelete(auction.id, auction.title)}
                      className="bg-red-900/40 hover:bg-red-800/60 text-red-300 border border-red-800/50 px-4 py-2 rounded-xl text-sm transition-smooth"
                    >
                      מחק
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
