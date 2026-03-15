'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

interface RegisterPromptProps {
  auctionId: string;
  isLoggedIn: boolean;
}

export default function RegisterPrompt({ auctionId, isLoggedIn }: RegisterPromptProps) {
  const { profile } = useAuth();

  // Approved users are auto-registered by useRegistration hook — no prompt needed
  if (isLoggedIn && profile?.verificationStatus === 'approved') {
    return null;
  }

  // Logged in but pending approval — clear status message
  if (isLoggedIn && profile?.verificationStatus === 'pending_approval') {
    return (
      <div className="glass rounded-xl p-4 text-center space-y-2 border border-yellow-500/30">
        <p className="text-sm font-semibold text-yellow-400">החשבון שלך ממתין לאישור</p>
        <p className="text-xs text-text-secondary">נציג יאשר את חשבונך בקרוב. תוכל להציע ברגע שתאושר.</p>
      </div>
    );
  }

  // Logged in but pending verification — CTA to complete verification
  if (isLoggedIn && profile?.verificationStatus === 'pending_verification') {
    return (
      <div className="glass rounded-xl p-4 text-center space-y-3 border border-accent/30">
        <p className="text-sm font-semibold">יש להשלים אימות חשבון כדי להשתתף</p>
        <p className="text-xs text-text-secondary">השלם את האימות ונציג יאשר את חשבונך</p>
        <Link
          href="/verify"
          className="btn-accent px-6 py-2 rounded-lg text-sm inline-block font-semibold"
        >
          השלם אימות
        </Link>
      </div>
    );
  }

  // Logged in but rejected
  if (isLoggedIn && profile?.verificationStatus === 'rejected') {
    return (
      <div className="glass rounded-xl p-4 text-center space-y-2 border border-red-500/30">
        <p className="text-sm font-semibold text-red-400">החשבון שלך נדחה</p>
        <p className="text-xs text-text-secondary">פנה לתמיכה לבירור.</p>
      </div>
    );
  }

  // Not logged in — direct to full registration page (one unified flow)
  return (
    <div className="glass rounded-xl p-4 text-center space-y-3 border border-accent/30">
      <p className="text-sm font-semibold">
        הירשם כדי להשתתף במכרז
      </p>
      <p className="text-xs text-text-secondary">
        הרשמה כוללת חתימה דיגיטלית ואישור תקנון — תהליך אחד מהיר
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
          className="btn-accent px-6 py-2 rounded-lg text-sm font-semibold"
        >
          הרשמה חדשה
        </Link>
      </div>
    </div>
  );
}
