'use client';

import { useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/ui/Navbar';
import { useAllAuctions } from '@/lib/hooks';
import { AuctionStatusBadge } from '@/components/ui/StatusBadge';
import { SkeletonGrid } from '@/components/ui/Skeleton';
import LiveBadge from '@/components/ui/LiveBadge';

export default function AuctionsPage() {
  const { auctions, loading } = useAllAuctions();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string>('all');

  const filtered = auctions.filter((a) => {
    if (filter !== 'all' && a.status !== filter) return false;
    if (search && !a.title.includes(search) && !a.houseName.includes(search)) return false;
    return true;
  });

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">מכרזים</h1>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש מכרז..."
            className="flex-1 bg-bg-elevated border border-border rounded-lg px-4 py-2 text-white placeholder:text-text-secondary focus:outline-none focus:border-accent transition-smooth"
          />
          <div className="flex gap-2">
            {['all', 'live', 'published', 'ended'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg text-sm transition-smooth
                  ${filter === f ? 'bg-accent text-white' : 'bg-bg-elevated text-text-secondary hover:text-white'}`}
              >
                {f === 'all' ? 'הכל' : f === 'live' ? 'חי' : f === 'published' ? 'קרוב' : 'הסתיים'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <SkeletonGrid count={6} />
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-text-secondary">
            <div className="text-4xl mb-3">📭</div>
            <p>לא נמצאו מכרזים</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((auction) => (
              <Link
                key={auction.id}
                href={auction.status === 'live' ? '/live' : `/auctions/${auction.id}`}
                className="glass rounded-xl p-5 hover:border-accent/30 transition-smooth border border-transparent group"
              >
                <div className="flex items-center justify-between mb-3">
                  {auction.status === 'live' ? (
                    <LiveBadge />
                  ) : (
                    <AuctionStatusBadge status={auction.status} />
                  )}
                  <span className="text-xs text-text-secondary">
                    {new Date(auction.scheduledAt).toLocaleDateString('he-IL')}
                  </span>
                </div>
                <h3 className="font-bold text-lg mb-1 group-hover:text-accent transition-smooth">
                  {auction.title}
                </h3>
                <p className="text-sm text-text-secondary mb-3">{auction.houseName}</p>
                <div className="flex justify-between text-xs text-text-secondary">
                  <span>
                    {new Date(auction.scheduledAt).toLocaleTimeString('he-IL', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
