'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useLiveAuction } from '@/lib/hooks';
import { LogoCompact } from './Logo';

export default function Navbar() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const { auctionId } = useLiveAuction();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/');
  };

  const isAdmin = profile?.role === 'admin' || profile?.role === 'house_manager';

  return (
    <nav className="glass sticky top-0 z-50 border-b border-border">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center">
            <LogoCompact height={30} />
          </Link>
          <div className="hidden md:flex items-center gap-1">
            <NavLink href="/auctions">מכרזים</NavLink>
            {auctionId && (
              <Link href="/live" className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-white/5 transition-smooth">
                <span className="live-dot" />
                <span className="text-live-dot font-semibold">שידור חי</span>
              </Link>
            )}
            {user && <NavLink href="/my-bids">ההצעות שלי</NavLink>}
            {isAdmin && <NavLink href="/admin">ניהול</NavLink>}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <span className="text-text-secondary text-sm hidden md:inline truncate max-w-[120px]">
                {profile?.displayName || user.email}
              </span>
              <button onClick={handleLogout} className="bg-bg-elevated hover:bg-bg-surface border border-border text-white text-xs px-3 py-2 rounded-lg transition-smooth">
                יציאה
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-text-secondary hover:text-white transition-smooth text-sm hidden md:inline px-3 py-2">
                התחברות
              </Link>
              <Link href="/register" className="bg-accent hover:bg-accent-hover text-white text-xs px-4 py-2 rounded-lg transition-smooth">
                הרשמה
              </Link>
            </>
          )}

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg bg-bg-elevated border border-border"
          >
            <span className="text-white text-sm">{mobileOpen ? '✕' : '☰'}</span>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-bg-surface/95 backdrop-blur-xl">
          <div className="p-4 space-y-1">
            <MobileNavLink href="/auctions" onClick={() => setMobileOpen(false)}>מכרזים</MobileNavLink>
            {auctionId && (
              <MobileNavLink href="/live" onClick={() => setMobileOpen(false)}>
                <span className="flex items-center gap-2">
                  <span className="live-dot" />
                  שידור חי
                </span>
              </MobileNavLink>
            )}
            {user && <MobileNavLink href="/my-bids" onClick={() => setMobileOpen(false)}>ההצעות שלי</MobileNavLink>}
            {isAdmin && <MobileNavLink href="/admin" onClick={() => setMobileOpen(false)}>ניהול</MobileNavLink>}
            {!user && <MobileNavLink href="/login" onClick={() => setMobileOpen(false)}>התחברות</MobileNavLink>}
          </div>
        </div>
      )}
    </nav>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-text-secondary hover:text-white transition-smooth text-sm px-3 py-2 rounded-lg hover:bg-white/5">
      {children}
    </Link>
  );
}

function MobileNavLink({ href, onClick, children }: { href: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="block px-4 py-3 rounded-xl text-sm text-text-secondary hover:text-white hover:bg-white/5 transition-smooth"
    >
      {children}
    </Link>
  );
}
