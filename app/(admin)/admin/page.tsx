'use client';

import Link from 'next/link';
import { useAllAuctions } from '@/lib/hooks';
import { useAuth } from '@/lib/auth-context';
import Navbar from '@/components/ui/Navbar';
import { AuctionStatusBadge } from '@/components/ui/StatusBadge';

export default function AdminDashboard() {
  const { auctions: allAuctions } = useAllAuctions();
  const { profile } = useAuth();

  // House managers only see their own auctions
  const auctions = profile?.role === 'house_manager' && profile.houseId
    ? allAuctions.filter((a) => a.houseId === profile.houseId)
    : allAuctions;

  const liveCount = auctions.filter((a) => a.status === 'live').length;
  const publishedCount = auctions.filter((a) => a.status === 'published').length;
  const endedCount = auctions.filter((a) => a.status === 'ended').length;

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">פאנל ניהול</h1>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="סה&quot;כ מכרזים" value={auctions.length.toString()} />
          <StatCard label="חי עכשיו" value={liveCount.toString()} color="text-live-dot" />
          <StatCard label="מפורסמים" value={publishedCount.toString()} color="text-accent" />
          <StatCard label="הסתיימו" value={endedCount.toString()} />
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Link href="/admin/auctions/new" className="glass rounded-xl p-6 hover:border-accent/30 transition-smooth border border-transparent text-center">
            <div className="text-3xl mb-2">➕</div>
            <div className="font-bold">צור מכרז חדש</div>
          </Link>
          <Link href="/admin/auctions" className="glass rounded-xl p-6 hover:border-accent/30 transition-smooth border border-transparent text-center">
            <div className="text-3xl mb-2">📋</div>
            <div className="font-bold">נהל מכרזים</div>
          </Link>
          <Link href="/admin/live" className="glass rounded-xl p-6 hover:border-accent/30 transition-smooth border border-transparent text-center">
            <div className="text-3xl mb-2">🎛️</div>
            <div className="font-bold">פאנל כרוז (לייב)</div>
          </Link>
          <Link href="/admin/houses" className="glass rounded-xl p-6 hover:border-accent/30 transition-smooth border border-transparent text-center">
            <div className="text-3xl mb-2">🏠</div>
            <div className="font-bold">בתי מכירות ומשתמשים</div>
          </Link>
        </div>

        {/* Recent Auctions */}
        <h2 className="text-lg font-bold mb-4">מכרזים אחרונים</h2>
        <div className="space-y-2">
          {auctions.slice(0, 10).map((auction) => (
            <Link
              key={auction.id}
              href={`/admin/auctions/${auction.id}`}
              className="glass rounded-lg p-4 flex items-center justify-between hover:border-accent/30 transition-smooth border border-transparent"
            >
              <div>
                <div className="font-semibold">{auction.title}</div>
                <div className="text-sm text-text-secondary">
                  {auction.houseName} • {new Date(auction.scheduledAt).toLocaleDateString('he-IL')}
                </div>
              </div>
              <AuctionStatusBadge status={auction.status} />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color = 'text-white' }: { label: string; value: string; color?: string }) {
  return (
    <div className="glass rounded-xl p-4 text-center">
      <div className={`text-3xl font-black ${color}`}>{value}</div>
      <div className="text-sm text-text-secondary mt-1">{label}</div>
    </div>
  );
}
