'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ref, update, onValue } from 'firebase/database';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import { VerificationStatus } from '@/lib/types';
import Navbar from '@/components/ui/Navbar';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import toast from 'react-hot-toast';

export default function VerifyPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect');
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus | null>(null);
  const [callbackRequested, setCallbackRequested] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Listen to verification status changes in real-time
  useEffect(() => {
    if (!user) return;
    const userRef = ref(db, `users/${user.uid}/verificationStatus`);
    const unsub = onValue(userRef, (snap) => {
      if (snap.exists()) {
        setVerificationStatus(snap.val() as VerificationStatus);
      }
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/register');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (verificationStatus === 'approved') {
      toast.success('החשבון אושר! כעת ניתן להשתתף במכרזים', { id: 'approved' });
      router.push(redirect || '/auctions');
    }
  }, [verificationStatus, router, redirect]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user) return null;

  const handleRequestCallback = async () => {
    setSubmitting(true);
    try {
      await update(ref(db, `users/${user.uid}`), {
        callbackRequested: true,
        verificationStatus: 'pending_approval',
      });
      setCallbackRequested(true);
      toast.success('בקשתך התקבלה! נציג יחזור אליך בהקדם');
    } catch {
      toast.error('שגיאה בשליחת הבקשה');
    } finally {
      setSubmitting(false);
    }
  };

  const isPendingApproval = verificationStatus === 'pending_approval' || callbackRequested || profile?.callbackRequested;
  const isRejected = verificationStatus === 'rejected';

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-lg mx-auto px-4 py-16">
        <div className="glass rounded-2xl p-8 space-y-6 text-center">
          {isRejected ? (
            <>
              <div className="text-5xl">&#10060;</div>
              <h1 className="text-2xl font-bold">הבקשה נדחתה</h1>
              <p className="text-text-secondary">
                בקשת ההשתתפות שלך נדחתה. לפרטים נוספים ניתן ליצור קשר עם office@m-motors.co.il
              </p>
            </>
          ) : isPendingApproval ? (
            <>
              <div className="text-5xl">&#9203;</div>
              <h1 className="text-2xl font-bold">ממתין לאישור</h1>
              <p className="text-text-secondary">
                בקשתך התקבלה ותטופל בהקדם. נציג מיכאלי מוטורס יחזור אליך
                לאימות ואישור ההשתתפות.
              </p>
              <div className="bg-accent/10 rounded-xl p-4 text-sm text-accent-light">
                ברגע שחשבונך יאושר, תוכל/י להציע הצעות ולהשתתף במכרזים חיים.
                עמוד זה יתעדכן אוטומטית.
              </div>
            </>
          ) : (
            <>
              <div className="text-5xl">&#128272;</div>
              <h1 className="text-2xl font-bold">אימות חשבון</h1>
              <p className="text-text-secondary">
                כדי להשתתף במכרזים, יש לאמת את החשבון שלך באחת מהדרכים הבאות:
              </p>

              <div className="space-y-4 text-right">
                {/* Option 1: Payment verification - placeholder for Meshulam */}
                <div className="border border-border rounded-xl p-5 opacity-60">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">&#128179;</span>
                    <h3 className="font-bold">אימות באמצעות כרטיס אשראי</h3>
                  </div>
                  <p className="text-sm text-text-secondary">
                    אימות מהיר באמצעות הרשאת חיוב זמנית (authorization hold).
                    הסכום לא ייגבה בפועל.
                  </p>
                  <button
                    disabled
                    className="w-full mt-3 py-3 rounded-lg bg-bg-elevated text-text-secondary font-semibold cursor-not-allowed"
                  >
                    בקרוב
                  </button>
                </div>

                {/* Option 2: Callback request */}
                <div className="border border-accent/30 rounded-xl p-5">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">&#128222;</span>
                    <h3 className="font-bold">חזרה טלפונית מנציג</h3>
                  </div>
                  <p className="text-sm text-text-secondary">
                    נציג מיכאלי מוטורס יחזור אליך לאימות טלפוני ואישור ההשתתפות.
                  </p>
                  <button
                    onClick={handleRequestCallback}
                    disabled={submitting}
                    className="w-full mt-3 py-3 rounded-lg brand-gradient text-white font-semibold disabled:opacity-50"
                  >
                    {submitting ? 'שולח...' : 'בקש חזרה טלפונית'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
