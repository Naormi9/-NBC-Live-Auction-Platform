'use client';

import { useState } from 'react';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { LogoIcon } from '@/components/ui/Logo';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect');

  const handleReset = async () => {
    if (!email) {
      toast.error('הכנס אימייל קודם');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
      toast.success('אם האימייל רשום במערכת, נשלח מייל לאיפוס סיסמה');
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        toast.error('האימייל לא רשום במערכת');
      } else if (err.code === 'auth/invalid-email') {
        toast.error('כתובת אימייל לא תקינה');
      } else {
        // For Firebase with email enumeration protection, show neutral message
        setResetSent(true);
        toast.success('אם האימייל רשום במערכת, נשלח מייל לאיפוס סיסמה');
      }
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast.success('התחברת בהצלחה!', { id: 'login-success' });
      router.push(redirect || '/');
    } catch (err: any) {
      toast.error('שגיאה בהתחברות. בדוק את הפרטים.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 noise-bg">
      {/* Background glow */}
      <div className="fixed top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[400px] bg-accent/6 rounded-full blur-[100px] pointer-events-none" />

      <div className="glass-elevated rounded-2xl p-8 w-full max-w-md space-y-6 relative animate-scale-in">
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <LogoIcon size={48} />
          </div>
          <h1 className="text-2xl text-heading">התחברות</h1>
          <p className="text-text-secondary text-sm">
            הכנס למרכז המכרזים הארצי
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm text-text-secondary mb-1">אימייל</label>
            <input
              id="email"
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
            <label htmlFor="password" className="block text-sm text-text-secondary mb-1">סיסמה</label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full bg-bg-elevated border border-border rounded-lg px-4 py-3 pl-12 text-white placeholder:text-text-secondary/50 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-smooth"
                placeholder="••••••••"
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
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full btn-accent py-3 rounded-lg text-lg font-bold disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-5 h-5 border-2 border-bg-primary/30 border-t-bg-primary rounded-full animate-spin" />
                מתחבר...
              </span>
            ) : 'התחבר'}
          </button>
        </form>

        <div className="text-center">
          <button
            type="button"
            onClick={handleReset}
            className="text-sm text-accent hover:underline transition-smooth"
          >
            {resetSent ? 'נשלח! בדוק את המייל' : 'שכחתי סיסמה'}
          </button>
        </div>

        <div className="text-center text-sm text-text-secondary">
          אין לך חשבון?{' '}
          <Link href="/register" className="text-accent hover:underline font-medium">
            הרשם כאן
          </Link>
        </div>
      </div>
    </div>
  );
}
