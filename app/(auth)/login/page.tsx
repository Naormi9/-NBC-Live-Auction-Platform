'use client';

import { useState } from 'react';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const router = useRouter();

  const handleReset = async () => {
    if (!email) {
      toast.error('הכנס אימייל קודם');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
      toast.success('נשלח מייל לאיפוס סיסמה');
    } catch {
      toast.error('שגיאה בשליחת מייל איפוס');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast.success('התחברת בהצלחה!');
      router.push('/');
    } catch (err: any) {
      toast.error('שגיאה בהתחברות. בדוק את הפרטים.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="glass rounded-2xl p-8 w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">התחברות</h1>
          <p className="text-text-secondary text-sm mt-2">
            הכנס למרכז המכרזים הארצי
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1">אימייל</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-bg-elevated border border-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-accent transition-smooth"
              placeholder="your@email.com"
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1">סיסמה</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-bg-elevated border border-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-accent transition-smooth"
              placeholder="••••••••"
              dir="ltr"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full btn-accent py-3 rounded-lg text-lg font-bold disabled:opacity-50"
          >
            {loading ? 'מתחבר...' : 'התחבר'}
          </button>
        </form>

        <div className="text-center">
          <button
            type="button"
            onClick={handleReset}
            className="text-sm text-accent hover:underline"
          >
            {resetSent ? 'נשלח! בדוק את המייל' : 'שכחתי סיסמה'}
          </button>
        </div>

        <div className="text-center text-sm text-text-secondary">
          אין לך חשבון?{' '}
          <Link href="/register" className="text-accent hover:underline">
            הרשם כאן
          </Link>
        </div>
      </div>
    </div>
  );
}
