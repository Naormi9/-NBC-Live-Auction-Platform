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
          <StatCard label='סה"כ מכרזים' value={auctions.length.toString()} />
          <StatCard label="חי עכשיו" value={liveCount.toString()} color="text-live-dot" />
          <StatCard label="מפורסמים" value={publishedCount.toString()} color="text-accent" />
          <StatCard label="הסתיימו" value={endedCount.toString()} />
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
          <QuickAction href="/admin/auctions/new" icon="+" label="צור מכרז חדש" />
          <QuickAction href="/admin/auctions" icon="📋" label="נהל מכרזים" />
          <QuickAction href="/admin/live" icon="🎛️" label="פאנל כרוז" />
          <QuickAction href="/admin/registrations" icon="👥" label="ניהול נרשמים" />
          <QuickAction href="/admin/houses" icon="🏠" label="בתי מכירות" />
        </div>

        {/* Recent Auctions */}
        <h2 className="text-lg font-bold mb-4">מכרזים אחרונים</h2>
        {auctions.length === 0 ? (
          <div className="text-center py-12 text-text-secondary">אין מכרזים עדיין</div>
        ) : (
          <div className="space-y-2">
            {auctions.slice(0, 10).map((auction) => (
              <Link
                key={auction.id}
                href={`/admin/auctions/${auction.id}`}
                className="glass rounded-xl p-4 flex items-center justify-between hover:border-accent/30 transition-smooth border border-transparent group"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate group-hover:text-accent transition-smooth">{auction.title}</div>
                  <div className="text-sm text-text-secondary truncate">
                    {auction.houseName} • {new Date(auction.scheduledAt).toLocaleDateString('he-IL')}
                  </div>
                </div>
                <AuctionStatusBadge status={auction.status} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color = 'text-white' }: { label: string; value: string; color?: string }) {
  return (
    <div className="glass rounded-2xl p-5 text-center">
      <div className={`text-3xl font-black ${color}`}>{value}</div>
      <div className="text-sm text-text-secondary mt-1">{label}</div>
    </div>
  );
}

function QuickAction({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link href={href} className="glass rounded-2xl p-5 hover:border-accent/30 transition-smooth border border-transparent text-center group">
      <div className="text-2xl mb-2">{icon}</div>
      <div className="font-semibold text-sm group-hover:text-accent transition-smooth">{label}</div>
    </Link>
  );
}
