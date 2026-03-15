'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ref, set, serverTimestamp } from 'firebase/database';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import toast from 'react-hot-toast';

interface RegisterPromptProps {
  auctionId: string;
  isLoggedIn: boolean;
}

export default function RegisterPrompt({ auctionId, isLoggedIn }: RegisterPromptProps) {
  const { user, profile } = useAuth();
  const [registering, setRegistering] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Already approved - no prompt needed
  if (isLoggedIn && profile?.verificationStatus === 'approved') {
    return null;
  }

  // Logged in, approved, can register directly for this auction
  const handleRegisterForAuction = async () => {
    if (!user) return;
    if (!termsAccepted) {
      toast.error('יש לאשר את תנאי ההשתתפות');
      return;
    }
    setRegistering(true);
    try {
      await set(ref(db, `registrations/${auctionId}/${user.uid}`), {
        userId: user.uid,
        registeredAt: serverTimestamp(),
        status: 'registered',
        termsAcceptedAt: serverTimestamp(),
      });
      toast.success('נרשמת למכרז בהצלחה!');
    } catch (err: any) {
      toast.error('שגיאה בהרשמה למכרז');
    } finally {
      setRegistering(false);
    }
  };

  // Logged in but not approved - show verification status
  if (isLoggedIn && profile?.verificationStatus !== 'approved') {
    const statusMessage = profile?.verificationStatus === 'pending_approval'
      ? 'החשבון שלך ממתין לאישור. נציג יחזור אליך בהקדם.'
      : profile?.verificationStatus === 'rejected'
      ? 'החשבון שלך נדחה. פנה לתמיכה.'
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

  // Logged in + approved but not registered for this auction
  if (isLoggedIn && profile?.verificationStatus === 'approved') {
    return (
      <div className="glass rounded-xl p-4 text-center space-y-3 border border-accent/30">
        <p className="text-sm font-semibold">הירשם למכרז זה כדי להשתתף</p>
        <label className="flex items-center gap-2 text-xs justify-center cursor-pointer">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            className="accent-accent w-4 h-4"
          />
          <span>אני מאשר/ת את תנאי ההשתתפות במכרז</span>
        </label>
        <button
          onClick={handleRegisterForAuction}
          disabled={!termsAccepted || registering}
          className="btn-accent px-6 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
        >
          {registering ? 'נרשם...' : 'הירשם למכרז'}
        </button>
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
