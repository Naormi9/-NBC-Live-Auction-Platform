'use client';

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

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/');
  };

  return (
    <nav className="glass sticky top-0 z-50 border-b border-border" role="navigation" aria-label="ניווט ראשי">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center hover:opacity-80 transition-smooth" aria-label="דף הבית">
            <LogoCompact height={30} />
          </Link>
          <div className="hidden md:flex items-center gap-1">
            <Link
              href="/auctions"
              className="text-text-secondary hover:text-white hover:bg-white/5 transition-smooth text-sm px-3 py-2 rounded-lg"
            >
              מכרזים
            </Link>
            {auctionId && (
              <Link href="/live" className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg hover:bg-live-dot/10 transition-smooth">
                <span className="live-dot" aria-hidden="true" />
                <span className="text-live-dot font-semibold">שידור חי</span>
              </Link>
            )}
            {user && (
              <Link
                href="/my-bids"
                className="text-text-secondary hover:text-white hover:bg-white/5 transition-smooth text-sm px-3 py-2 rounded-lg"
              >
                ההצעות שלי
              </Link>
            )}
            {(profile?.role === 'admin' || profile?.role === 'house_manager') && (
              <Link
                href="/admin"
                className="text-text-secondary hover:text-white hover:bg-white/5 transition-smooth text-sm px-3 py-2 rounded-lg"
              >
                ניהול
              </Link>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <span className="text-text-secondary text-sm hidden md:inline">
                {profile?.displayName || user.email}
              </span>
              <button
                onClick={handleLogout}
                className="btn-dark text-xs px-3 py-2 rounded-lg"
                aria-label="התנתק מהחשבון"
              >
                יציאה
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-text-secondary hover:text-white transition-smooth text-sm px-3 py-2 rounded-lg hover:bg-white/5">
                התחברות
              </Link>
              <Link href="/register" className="btn-accent text-xs px-4 py-2 rounded-lg">
                הרשמה
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
