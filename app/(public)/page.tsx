'use client';

import Link from 'next/link';
import Navbar from '@/components/ui/Navbar';
import LiveBadge from '@/components/ui/LiveBadge';
import { useAllAuctions, useLiveAuction } from '@/lib/hooks';
import { AuctionStatusBadge } from '@/components/ui/StatusBadge';
import { SkeletonGrid } from '@/components/ui/Skeleton';
import { LogoFull, LogoIcon } from '@/components/ui/Logo';

export default function HomePage() {
  const { auctions, loading } = useAllAuctions();
  const { auctionId } = useLiveAuction();
  const liveAuctions = auctions.filter((a) => a.status === 'live');
  const upcomingAuctions = auctions.filter((a) => a.status === 'published');

  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#433BFF]/8 via-transparent to-[#89A6FB]/5" />
        <div className="max-w-5xl mx-auto px-4 py-20 md:py-32 text-center relative">
          <div className="inline-flex items-center gap-2 bg-accent/10 text-accent-light px-4 py-2 rounded-full text-sm font-medium mb-6">
            <LogoIcon size={18} />
            מכרזי מיכאלי מוטורס
          </div>
          <h1 className="text-4xl md:text-6xl font-black leading-tight mb-6">
            אצלנו אתם קובעים
            <br />
            <span className="brand-gradient-text">את המחיר!</span>
          </h1>
          <p className="text-text-secondary text-lg md:text-xl max-w-2xl mx-auto mb-8">
            מכרזי רכבים חיים של מיכאלי מוטורס — יוקרה, משפחתיות, ג&apos;יפים ועוד. הציעו מחיר והשתתפו בלייב
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/auctions" className="bg-bg-elevated hover:bg-bg-surface border border-border text-white text-base px-8 py-4 rounded-xl font-semibold transition-smooth">
              לצפייה במכרזים פעילים
            </Link>
            <Link href="/register" className="brand-gradient text-white text-base px-8 py-4 rounded-xl font-semibold transition-smooth hover:opacity-90">
              להשתתפות במכרז
            </Link>
          </div>
        </div>
      </section>

      {/* Live Now Section */}
      {liveAuctions.length > 0 && (
        <section className="max-w-5xl mx-auto px-4 py-12">
          <div className="flex items-center gap-3 mb-6">
            <LiveBadge />
            <h2 className="text-xl font-bold">מכרזים פעילים עכשיו</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {liveAuctions.map((auction) => (
              <Link
                key={auction.id}
                href="/live"
                className="glass rounded-2xl p-6 hover:border-accent/30 transition-smooth border border-transparent group"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-bold group-hover:text-accent transition-smooth truncate">{auction.title}</h3>
                  <LiveBadge />
                </div>
                <div className="text-sm text-text-secondary truncate">
                  <span>{auction.houseName}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Upcoming Auctions */}
      <section className="max-w-5xl mx-auto px-4 py-12">
        <h2 className="text-xl font-bold mb-6">מכרזים קרובים</h2>
        {loading ? (
          <SkeletonGrid count={3} />
        ) : upcomingAuctions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcomingAuctions.map((auction) => (
              <Link
                key={auction.id}
                href={`/auctions/${auction.id}`}
                className="glass rounded-2xl p-5 hover:border-accent/30 transition-smooth border border-transparent group flex flex-col"
              >
                <div className="flex items-center justify-between mb-3">
                  <AuctionStatusBadge status={auction.status} />
                  <span className="text-xs text-text-secondary">
                    {new Date(auction.scheduledAt).toLocaleDateString('he-IL')}
                  </span>
                </div>
                <h3 className="font-bold mb-1 truncate group-hover:text-accent transition-smooth">{auction.title}</h3>
                <p className="text-sm text-text-secondary truncate">{auction.houseName}</p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-text-secondary">אין מכרזים קרובים כרגע</div>
        )}
      </section>

      {/* Features Section */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-center mb-12">למה מכרזי מיכאלי מוטורס?</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Feature
            icon="⚡"
            title="מכרזים בזמן אמת"
            desc="התמחרות חיה עם טיימר אקטיבי, 3 סיבובים ומדרגות קפיצה שמדייקות את המחיר"
          />
          <Feature
            icon="🔒"
            title="הוגנות ושקיפות"
            desc="כל הצעה מאומתת בשרת, איסור הקפצה עצמית וטיימר שמתאפס לתת לכולם סיכוי"
          />
          <Feature
            icon="📱"
            title="נוח מכל מכשיר"
            desc="ממשק מותאם למובייל — השתתפו במכרזים מכל מקום ובכל זמן"
          />
        </div>
      </section>

      {/* Stats */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <div className="glass rounded-2xl p-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <Stat value="500+" label="משתתפים רשומים" />
          <Stat value="150+" label="רכבים נמכרו" />
          <Stat value="98%" label="שביעות רצון" />
          <Stat value="24/7" label="תמיכה טכנית" />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-10">
        <div className="max-w-5xl mx-auto px-4 flex flex-col items-center gap-4">
          <LogoFull height={48} tm />
          <p className="text-text-secondary text-sm">© 2026 מיכאלי מוטורס. כל הזכויות שמורות.</p>
        </div>
      </footer>
    </div>
  );
}

function Feature({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="glass rounded-2xl p-6 text-center space-y-3">
      <div className="text-4xl">{icon}</div>
      <h3 className="text-lg font-bold">{title}</h3>
      <p className="text-text-secondary text-sm">{desc}</p>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-2xl md:text-3xl font-black brand-gradient-text">{value}</div>
      <div className="text-sm text-text-secondary mt-1">{label}</div>
    </div>
  );
}
