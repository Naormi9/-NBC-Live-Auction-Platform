'use client';

import Link from 'next/link';
import Navbar from '@/components/ui/Navbar';
import LiveBadge from '@/components/ui/LiveBadge';
import { useAllAuctions, useLiveAuction } from '@/lib/hooks';
import { AuctionStatusBadge } from '@/components/ui/StatusBadge';
import { formatPrice } from '@/lib/auction-utils';

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
        <div className="absolute inset-0 bg-gradient-to-b from-accent/5 to-transparent" />
        <div className="max-w-5xl mx-auto px-4 py-20 md:py-32 text-center relative">
          <div className="inline-flex items-center gap-2 bg-accent/10 text-accent px-4 py-2 rounded-full text-sm font-medium mb-6">
            פלטפורמת מכרזים חיים
          </div>
          <h1 className="text-4xl md:text-6xl font-black leading-tight mb-6">
            הדרך החדשה לקנות ולמכור.
            <br />
            <span className="text-accent">מכרזים חיים בזמן אמת.</span>
          </h1>
          <p className="text-text-secondary text-lg md:text-xl max-w-2xl mx-auto mb-8">
            פלטפורמת מכרזים בלייב הראשונה בישראל. צפו, הציעו והשתתפו במכרזים חיים של ספקים ועסקים מובילים
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/auctions" className="btn-dark text-base px-8 py-4 rounded-xl">
              לצפייה במכרזים פעילים
            </Link>
            <Link href="/register" className="btn-accent text-base px-8 py-4 rounded-xl">
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
                className="glass rounded-xl p-6 hover:border-accent/30 transition-smooth border border-transparent"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-bold">{auction.title}</h3>
                  <LiveBadge />
                </div>
                <div className="text-sm text-text-secondary">
                  <span>{auction.houseName}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Upcoming Auctions */}
      {upcomingAuctions.length > 0 && (
        <section className="max-w-5xl mx-auto px-4 py-12">
          <h2 className="text-xl font-bold mb-6">מכרזים קרובים</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcomingAuctions.map((auction) => (
              <Link
                key={auction.id}
                href={`/auctions/${auction.id}`}
                className="glass rounded-xl p-5 hover:border-accent/30 transition-smooth border border-transparent"
              >
                <div className="flex items-center justify-between mb-3">
                  <AuctionStatusBadge status={auction.status} />
                  <span className="text-xs text-text-secondary">
                    {new Date(auction.scheduledAt).toLocaleDateString('he-IL')}
                  </span>
                </div>
                <h3 className="font-bold mb-1">{auction.title}</h3>
                <p className="text-sm text-text-secondary">{auction.houseName}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Features Section */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-center mb-12">למה מרכז המכרזים הארצי?</h2>
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
      <footer className="border-t border-border py-8">
        <div className="max-w-5xl mx-auto px-4 text-center text-text-secondary text-sm">
          <p>© 2026 מרכז המכרזים הארצי — NBC. כל הזכויות שמורות.</p>
        </div>
      </footer>
    </div>
  );
}

function Feature({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="text-center space-y-3">
      <div className="text-4xl">{icon}</div>
      <h3 className="text-lg font-bold">{title}</h3>
      <p className="text-text-secondary text-sm">{desc}</p>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-2xl md:text-3xl font-black text-accent">{value}</div>
      <div className="text-sm text-text-secondary mt-1">{label}</div>
    </div>
  );
}
