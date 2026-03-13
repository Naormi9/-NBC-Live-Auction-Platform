'use client';

import { useState } from 'react';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { ref, update, serverTimestamp } from 'firebase/database';
import { auth, db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { LogoIcon } from '@/components/ui/Logo';

export default function RegisterPage() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName });
      await update(ref(db, `users/${cred.user.uid}`), {
        displayName,
        email,
        phone,
        role: 'participant',
        houseId: null,
        createdAt: serverTimestamp(),
      });
      toast.success('נרשמת בהצלחה!');
      router.push('/');
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
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="glass rounded-2xl p-8 w-full max-w-md space-y-6">
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <LogoIcon size={48} />
          </div>
          <h1 className="text-2xl font-bold">הרשמה</h1>
          <p className="text-text-secondary text-sm">
            הצטרפו למרכז המכרזים הארצי
          </p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1">שם מלא</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              className="w-full bg-bg-elevated border border-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-accent transition-smooth"
              placeholder="ישראל ישראלי"
            />
          </div>
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
            <label className="block text-sm text-text-secondary mb-1">טלפון</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              className="w-full bg-bg-elevated border border-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-accent transition-smooth"
              placeholder="050-1234567"
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
              minLength={6}
              className="w-full bg-bg-elevated border border-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-accent transition-smooth"
              placeholder="לפחות 6 תווים"
              dir="ltr"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full btn-accent py-3 rounded-lg text-lg font-bold disabled:opacity-50"
          >
            {loading ? 'נרשם...' : 'הירשם'}
          </button>
        </form>

        <div className="text-center text-sm text-text-secondary">
          יש לך חשבון?{' '}
          <Link href="/login" className="text-accent hover:underline">
            התחבר כאן
          </Link>
        </div>
      </div>
    </div>
  );
}
