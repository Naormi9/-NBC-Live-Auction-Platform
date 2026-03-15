'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

interface RegisterPromptProps {
  auctionId: string;
  isLoggedIn: boolean;
}

export default function RegisterPrompt({ auctionId, isLoggedIn }: RegisterPromptProps) {
  const { profile } = useAuth();

  // Already approved - no prompt needed
  if (isLoggedIn && profile?.verificationStatus === 'approved') {
    return null;
  }

  // Logged in but not approved - show verification status
  if (isLoggedIn) {
    const statusMessage = profile?.verificationStatus === 'pending_approval'
      ? 'החשבון שלך ממתין לאישור. נציג יחזור אליך בהקדם.'
      : 'יש לאמת את החשבון כדי להשתתף במכרז';

    return (
      <div className="glass rounded-xl p-4 text-center space-y-2 border border-accent/30">
        <p className="text-sm font-semibold">{statusMessage}</p>
        {profile?.verificationStatus === 'pending_verification' && (
          <Link
            href="/verify"
            className="btn-accent px-6 py-2 rounded-lg text-sm inline-block"
          >
            עבור לאימות חשבון
          </Link>
        )}
      </div>
    );
  }

  // Not logged in - direct to full registration page
  return (
    <div className="glass rounded-xl p-4 text-center space-y-2 border border-accent/30">
      <p className="text-sm font-semibold">
        התחבר והירשם למכרז כדי להשתתף
      </p>
      <div className="flex gap-3 justify-center">
        <Link
          href="/login"
          className="btn-dark px-6 py-2 rounded-lg text-sm"
        >
          התחברות
        </Link>
        <Link
          href="/register"
          className="btn-accent px-6 py-2 rounded-lg text-sm"
        >
          הרשמה
        </Link>
      </div>
    </div>
  );
}
