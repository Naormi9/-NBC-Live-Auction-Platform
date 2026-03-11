'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useLiveAuction } from '@/lib/hooks';

export default function Navbar() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const { auctionId } = useLiveAuction();

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/');
  };

  return (
    <nav className="glass sticky top-0 z-50 border-b border-border">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-xl font-bold text-white">
            NBC <span className="text-accent">מכרזים</span>
          </Link>
          <div className="hidden md:flex items-center gap-4">
            <Link href="/auctions" className="text-text-secondary hover:text-white transition-smooth text-sm">
              מכרזים
            </Link>
            {auctionId && (
              <Link href="/live" className="flex items-center gap-2 text-sm">
                <span className="live-dot" />
                <span className="text-live-dot font-semibold">שידור חי</span>
              </Link>
            )}
            {profile?.role === 'admin' && (
              <Link href="/admin" className="text-text-secondary hover:text-white transition-smooth text-sm">
                ניהול
              </Link>
            )}
            {profile?.role === 'house_manager' && (
              <Link href="/admin" className="text-text-secondary hover:text-white transition-smooth text-sm">
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
              <button onClick={handleLogout} className="btn-dark text-xs px-3 py-2 rounded-lg">
                יציאה
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-text-secondary hover:text-white transition-smooth text-sm">
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
