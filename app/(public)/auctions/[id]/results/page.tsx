'use client';

import { useParams } from 'next/navigation';
import { useAuction, useCatalog } from '@/lib/hooks';
import { formatPrice } from '@/lib/auction-utils';
import Navbar from '@/components/ui/Navbar';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function AuctionResultsPage() {
  const params = useParams();
  const auctionId = params.id as string;
  const { auction, loading: auctionLoading } = useAuction(auctionId);
  const { items, loading: itemsLoading } = useCatalog(auctionId);

  if (auctionLoading || itemsLoading) return <><Navbar /><LoadingSpinner size="lg" /></>;

  if (!auction) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="text-center py-20 text-text-secondary">מכרז לא נמצא</div>
      </div>
    );
  }

  if (auction.status !== 'ended') {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="text-center py-20 text-text-secondary">
          תוצאות יהיו זמינות לאחר סיום המכרז
        </div>
      </div>
    );
  }

  const soldItems = items.filter((i) => i.status === 'sold');
  const unsoldItems = items.filter((i) => i.status === 'unsold');
  const totalRevenue = soldItems.reduce((sum, i) => sum + (i.soldPrice || 0), 0);

  const anonymize = (name: string | null, index: number) => {
    if (!name) return '—';
    return `משתתף #${(index + 1).toString().padStart(3, '0')}`;
  };

  const handleShare = async () => {
    const text = `תוצאות מכרז "${auction.title}" — ${soldItems.length} פריטים נמכרו מתוך ${items.length} — סה"כ ${formatPrice(totalRevenue)}`;
    if (navigator.share) {
      await navigator.share({ title: auction.title, text, url: window.location.href });
    } else {
      await navigator.clipboard.writeText(`${text}\n${window.location.href}`);
    }
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className="glass rounded-xl p-6">
          <h1 className="text-2xl font-bold mb-2">תוצאות — {auction.title}</h1>
          <p className="text-text-secondary">{auction.houseName}</p>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label='סה"כ פריטים' value={items.length.toString()} />
          <StatCard label="נמכרו" value={soldItems.length.toString()} color="text-bid-price" />
          <StatCard label="לא נמכרו" value={unsoldItems.length.toString()} color="text-timer-red" />
          <StatCard label='סה"כ הכנסות' value={formatPrice(totalRevenue)} color="text-accent" />
        </div>

        {/* Sold items */}
        {soldItems.length > 0 && (
          <div className="glass rounded-xl p-6">
            <h2 className="font-bold mb-4 text-bid-price">פריטים שנמכרו ({soldItems.length})</h2>
            <div className="space-y-2">
              {soldItems.map((item, index) => (
                <div key={item.id} className="bg-bg-elevated rounded-lg p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-bid-price/20 text-bid-price flex items-center justify-center text-sm font-bold">
                      {item.order}
                    </span>
                    <div>
                      <div className="font-semibold">{item.title}</div>
                      <div className="text-xs text-text-secondary">
                        זוכה: {anonymize(item.currentBidderName, index)}
                      </div>
                    </div>
                  </div>
                  <div className="text-left">
                    <div className="text-xs text-text-secondary line-through">{formatPrice(item.openingPrice)}</div>
                    <div className="font-bold text-bid-price text-lg">{formatPrice(item.soldPrice || 0)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Unsold items */}
        {unsoldItems.length > 0 && (
          <div className="glass rounded-xl p-6">
            <h2 className="font-bold mb-4 text-text-secondary">פריטים שלא נמכרו ({unsoldItems.length})</h2>
            <div className="space-y-2">
              {unsoldItems.map((item) => (
                <div key={item.id} className="bg-bg-elevated rounded-lg p-4 flex items-center justify-between opacity-60">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-bg-surface flex items-center justify-center text-sm font-bold">
                      {item.order}
                    </span>
                    <div className="font-semibold">{item.title}</div>
                  </div>
                  <div className="text-text-secondary text-sm">{formatPrice(item.openingPrice)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Share button */}
        <button
          onClick={handleShare}
          className="w-full glass rounded-xl p-4 text-center font-semibold hover:border-accent/30 transition-smooth border border-transparent"
        >
          📤 שתף תוצאות
        </button>
      </div>
    </div>
  );
}

function StatCard({ label, value, color = 'text-white' }: { label: string; value: string; color?: string }) {
  return (
    <div className="glass rounded-xl p-4 text-center">
      <div className={`text-2xl font-black text-mono-nums ${color}`}>{value}</div>
      <div className="text-sm text-text-secondary mt-1">{label}</div>
    </div>
  );
}
