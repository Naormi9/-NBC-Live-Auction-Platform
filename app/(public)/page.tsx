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
    <div className="min-h-screen noise-bg">
      <Navbar />

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background layers */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-b from-accent/5 via-transparent to-transparent" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-accent/8 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-bid-price/5 rounded-full blur-[100px]" />
        </div>

        <div className="max-w-6xl mx-auto px-4 py-24 md:py-36 text-center relative">
          <div className="stagger-children">
            <div className="inline-flex items-center gap-2 bg-accent-muted text-accent-light px-4 py-2 rounded-full text-sm font-medium mb-8 border border-accent/15">
              <LogoIcon size={18} />
              מכרזי מיכאלי מוטורס
            </div>

            <h1 className="text-display text-5xl md:text-7xl mb-6">
              אצלנו אתם קובעים
              <br />
              <span className="brand-gradient-text">את המחיר!</span>
            </h1>

            <p className="text-text-secondary text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
              מכרזי רכבים חיים של מיכאלי מוטורס — יוקרה, משפחתיות, ג&apos;יפים ועוד.
              <br className="hidden md:block" />
              הציעו מחיר והשתתפו בלייב
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/register"
                className="brand-gradient text-bg-primary text-base px-8 py-4 rounded-xl font-bold transition-smooth hover:opacity-90 shadow-glow-accent"
              >
                להשתתפות במכרז
              </Link>
              <Link
                href="/auctions"
                className="btn-dark text-base px-8 py-4 rounded-xl"
              >
                לצפייה במכרזים פעילים
              </Link>
            </div>
          </div>
        </div>

        {/* Decorative bottom edge */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent/20 to-transparent" />
      </section>

      {/* Live Now Section */}
      {liveAuctions.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 py-12 relative">
          <div className="flex items-center gap-3 mb-6">
            <LiveBadge />
            <h2 className="text-xl text-heading">מכרזים פעילים עכשיו</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger-children">
            {liveAuctions.map((auction) => (
              <Link
                key={auction.id}
                href="/live"
                className="glass rounded-xl p-6 hover:border-accent/30 transition-smooth border border-transparent group"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg text-heading group-hover:text-accent transition-smooth">{auction.title}</h3>
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
      <section className="max-w-6xl mx-auto px-4 py-12 relative">
        <h2 className="text-xl text-heading mb-6">מכרזים קרובים</h2>
        {loading ? (
          <SkeletonGrid count={3} />
        ) : upcomingAuctions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
            {upcomingAuctions.map((auction) => (
              <Link
                key={auction.id}
                href={`/auctions/${auction.id}`}
                className="glass rounded-xl p-5 hover:border-accent/25 transition-smooth border border-transparent group"
              >
                <div className="flex items-center justify-between mb-3">
                  <AuctionStatusBadge status={auction.status} />
                  <span className="text-xs text-text-secondary">
                    {new Date(auction.scheduledAt).toLocaleDateString('he-IL')}
                  </span>
                </div>
                <h3 className="font-bold mb-1 group-hover:text-accent transition-smooth">{auction.title}</h3>
                <p className="text-sm text-text-secondary">{auction.houseName}</p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-text-secondary">אין מכרזים קרובים כרגע</div>
        )}
      </section>

      {/* Features Section */}
      <section className="max-w-6xl mx-auto px-4 py-20">
        <h2 className="text-display text-3xl text-center mb-4">למה מכרזי מיכאלי מוטורס?</h2>
        <p className="text-text-secondary text-center mb-14 max-w-xl mx-auto">
          שנים של ניסיון במכרזי רכבים, טכנולוגיה מתקדמת, ושקיפות מלאה
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 stagger-children">
          <Feature
            icon={
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
              </svg>
            }
            title="מכרזים בזמן אמת"
            desc="התמחרות חיה עם טיימר אקטיבי, 3 סיבובים ומדרגות קפיצה שמדייקות את המחיר"
          />
          <Feature
            icon={
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
              </svg>
            }
            title="הוגנות ושקיפות"
            desc="כל הצעה מאומתת בשרת, איסור הקפצה עצמית וטיימר שמתאפס לתת לכולם סיכוי"
          />
          <Feature
            icon={
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><path d="M12 18h.01"/>
              </svg>
            }
            title="נוח מכל מכשיר"
            desc="ממשק מותאם למובייל — השתתפו במכרזים מכל מקום ובכל זמן"
          />
        </div>
      </section>

      {/* Stats */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <div className="glass rounded-2xl p-8 md:p-10 grid grid-cols-2 md:grid-cols-4 gap-6 text-center border border-accent/10 stagger-children">
          <Stat value="500+" label="משתתפים רשומים" />
          <Stat value="150+" label="רכבים נמכרו" />
          <Stat value="98%" label="שביעות רצון" />
          <Stat value="24/7" label="תמיכה טכנית" />
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-6xl mx-auto px-4 py-20">
        <div className="relative rounded-2xl overflow-hidden">
          <div className="absolute inset-0 brand-gradient opacity-10" />
          <div className="absolute inset-0 bg-gradient-to-t from-bg-primary/80 to-transparent" />
          <div className="relative text-center py-16 px-6">
            <h2 className="text-display text-3xl md:text-4xl mb-4">מוכנים להתחיל?</h2>
            <p className="text-text-secondary text-lg mb-8 max-w-lg mx-auto">
              הירשמו עכשיו וקבלו התראות על מכרזים חדשים
            </p>
            <Link
              href="/register"
              className="brand-gradient text-bg-primary text-lg px-10 py-4 rounded-xl font-bold transition-smooth hover:opacity-90 shadow-glow-accent inline-block"
            >
              הירשם עכשיו
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12" role="contentinfo">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <LogoFull height={44} tm />
            <nav className="flex items-center gap-6 text-sm text-text-secondary" aria-label="ניווט תחתון">
              <Link href="/auctions" className="hover:text-white transition-smooth">מכרזים</Link>
              <Link href="/terms" className="hover:text-white transition-smooth">תקנון</Link>
              <Link href="/register" className="hover:text-white transition-smooth">הרשמה</Link>
              <Link href="/login" className="hover:text-white transition-smooth">התחברות</Link>
            </nav>
          </div>
          <div className="border-t border-border mt-8 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-text-secondary/60 text-xs">© 2026 מיכאלי מוטורס. כל הזכויות שמורות.</p>
            <p className="text-text-secondary/40 text-xs">office@m-motors.co.il</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="glass rounded-xl p-6 text-center space-y-4 border border-border hover:border-accent/20 transition-smooth group">
      <div className="w-14 h-14 rounded-xl bg-accent-muted flex items-center justify-center mx-auto group-hover:scale-110 transition-smooth">
        {icon}
      </div>
      <h3 className="text-lg text-heading">{title}</h3>
      <p className="text-text-secondary text-sm leading-relaxed">{desc}</p>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-2xl md:text-3xl font-black brand-gradient-text text-mono-nums">{value}</div>
      <div className="text-sm text-text-secondary mt-1">{label}</div>
    </div>
  );
}
