'use client';

import { useState } from 'react';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { ref, update, serverTimestamp } from 'firebase/database';
import { auth, db } from '@/lib/firebase';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { LogoIcon } from '@/components/ui/Logo';
import { validateIsraeliId } from '@/lib/id-validator';
import SignaturePad from '@/components/registration/SignaturePad';

export default function RegisterPage() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect');

  const passwordStrength = (() => {
    if (password.length === 0) return null;
    if (password.length < 6) return { label: 'חלשה', color: 'bg-timer-red', width: 'w-1/4' };
    if (password.length < 8) return { label: 'בינונית', color: 'bg-timer-orange', width: 'w-2/4' };
    if (/[A-Z]/.test(password) && /[0-9]/.test(password) && password.length >= 10) return { label: 'חזקה', color: 'bg-bid-price', width: 'w-full' };
    return { label: 'סבירה', color: 'bg-timer-green', width: 'w-3/4' };
  })();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate Israeli ID
    if (!validateIsraeliId(idNumber)) {
      toast.error('מספר ת"ז לא תקין');
      return;
    }

    // Validate password match
    if (password !== confirmPassword) {
      toast.error('הסיסמאות לא תואמות');
      return;
    }

    // Validate signature
    if (!signatureData) {
      toast.error('נדרשת חתימה דיגיטלית');
      return;
    }

    // Validate terms
    if (!termsAccepted) {
      toast.error('יש לאשר את תקנון המכרז');
      return;
    }

    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName });
      await update(ref(db, `users/${cred.user.uid}`), {
        displayName,
        email,
        phone,
        idNumber: idNumber.padStart(9, '0'),
        role: 'participant',
        houseId: null,
        createdAt: serverTimestamp(),
        verificationStatus: 'pending_verification',
        termsAcceptedAt: Date.now(),
        signatureData,
        callbackRequested: false,
      });
      toast.success('נרשמת בהצלחה! כעת יש לאמת את החשבון', { id: 'register-success' });
      router.push(redirect ? `/verify?redirect=${encodeURIComponent(redirect)}` : '/verify');
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        toast.error('האימייל כבר רשום במערכת');
      } else {
        toast.error('שגיאה בהרשמה');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 noise-bg">
      {/* Background glow */}
      <div className="fixed top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[400px] bg-accent/6 rounded-full blur-[100px] pointer-events-none" />

      <div className="glass-elevated rounded-2xl p-8 w-full max-w-md space-y-6 relative animate-scale-in">
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <LogoIcon size={48} />
          </div>
          <h1 className="text-2xl text-heading">הרשמה</h1>
          <p className="text-text-secondary text-sm">
            הצטרפו למכרזי מיכאלי מוטורס
          </p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm text-text-secondary mb-1">שם מלא</label>
            <input
              id="name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              autoComplete="name"
              className="w-full bg-bg-elevated border border-border rounded-lg px-4 py-3 text-white placeholder:text-text-secondary/50 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-smooth"
              placeholder="ישראל ישראלי"
            />
          </div>

          <div>
            <label htmlFor="idNumber" className="block text-sm text-text-secondary mb-1">תעודת זהות</label>
            <input
              id="idNumber"
              type="text"
              value={idNumber}
              onChange={(e) => setIdNumber(e.target.value.replace(/\D/g, '').slice(0, 9))}
              required
              maxLength={9}
              inputMode="numeric"
              className="w-full bg-bg-elevated border border-border rounded-lg px-4 py-3 text-white placeholder:text-text-secondary/50 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-smooth text-mono-nums"
              placeholder="9 ספרות"
              dir="ltr"
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm text-text-secondary mb-1">טלפון</label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              autoComplete="tel"
              className="w-full bg-bg-elevated border border-border rounded-lg px-4 py-3 text-white placeholder:text-text-secondary/50 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-smooth text-mono-nums"
              placeholder="050-1234567"
              dir="ltr"
            />
          </div>

          <div>
            <label htmlFor="reg-email" className="block text-sm text-text-secondary mb-1">אימייל</label>
            <input
              id="reg-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full bg-bg-elevated border border-border rounded-lg px-4 py-3 text-white placeholder:text-text-secondary/50 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-smooth"
              placeholder="your@email.com"
              dir="ltr"
            />
          </div>

          <div>
            <label htmlFor="reg-password" className="block text-sm text-text-secondary mb-1">סיסמה</label>
            <div className="relative">
              <input
                id="reg-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                className="w-full bg-bg-elevated border border-border rounded-lg px-4 py-3 pl-12 text-white placeholder:text-text-secondary/50 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-smooth"
                placeholder="לפחות 6 תווים"
                dir="ltr"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-white transition-smooth text-sm"
                aria-label={showPassword ? 'הסתר סיסמה' : 'הצג סיסמה'}
              >
                {showPassword ? '🙈' : '👁'}
              </button>
            </div>
            {/* Password strength indicator */}
            {passwordStrength && (
              <div className="mt-2 space-y-1">
                <div className="h-1 bg-bg-elevated rounded-full overflow-hidden">
                  <div className={`h-full ${passwordStrength.color} ${passwordStrength.width} transition-all duration-300 rounded-full`} />
                </div>
                <p className="text-[10px] text-text-secondary">חוזק: {passwordStrength.label}</p>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="confirm-password" className="block text-sm text-text-secondary mb-1">אישור סיסמה</label>
            <input
              id="confirm-password"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              className={`w-full bg-bg-elevated border rounded-lg px-4 py-3 text-white placeholder:text-text-secondary/50 focus:outline-none focus:ring-1 transition-smooth ${
                confirmPassword && confirmPassword !== password
                  ? 'border-timer-red focus:border-timer-red focus:ring-timer-red/30'
                  : confirmPassword && confirmPassword === password
                    ? 'border-bid-price focus:border-bid-price focus:ring-bid-price/30'
                    : 'border-border focus:border-accent focus:ring-accent/30'
              }`}
              placeholder="הקלד שוב את הסיסמה"
              dir="ltr"
            />
            {confirmPassword && confirmPassword !== password && (
              <p className="text-[10px] text-timer-red mt-1">הסיסמאות לא תואמות</p>
            )}
          </div>

          {/* Terms acceptance section with digital signature */}
          <div className="border border-accent/20 rounded-xl p-4 space-y-3 bg-accent-muted">
            <h3 className="text-sm font-bold text-white">אישור תנאי השתתפות במכרז</h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              בחתימתי למטה אני מאשר/ת שקראתי והבנתי את{' '}
              <Link href="/terms" target="_blank" className="text-accent hover:underline">
                תקנון המכרז
              </Link>{' '}
              ואת תנאי השימוש. אני מתחייב/ת לעמוד בתנאי ההשתתפות, לרבות תשלום מלא במקרה של זכייה. ידוע לי כי אי-תשלום יגרור חילוט ערבות, חסימה מהשתתפות עתידית, ונקיטת הליכים משפטיים. חתימה זו מהווה הסכמה משפטית מחייבת.
            </p>

            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="terms"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-1 accent-accent w-4 h-4 flex-shrink-0"
              />
              <label htmlFor="terms" className="text-sm text-text-secondary cursor-pointer">
                קראתי ואני מסכים/ה לתקנון המכרז ולתנאי השימוש
              </label>
            </div>

            <SignaturePad onSignatureChange={setSignatureData} />
            <p className="text-xs text-text-secondary/60 text-center">
              החתימה למעלה מהווה אישור דיגיטלי להשתתפותך במכרז
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-accent py-3 rounded-lg text-lg font-bold disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-5 h-5 border-2 border-bg-primary/30 border-t-bg-primary rounded-full animate-spin" />
                נרשם...
              </span>
            ) : 'הירשם'}
          </button>
        </form>

        <div className="text-center text-sm text-text-secondary">
          יש לך חשבון?{' '}
          <Link href="/login" className="text-accent hover:underline font-medium">
            התחבר כאן
          </Link>
        </div>
      </div>
    </div>
  );
}
