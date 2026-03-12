'use client';

import { useState } from 'react';
import { createUserWithEmailAndPassword, updateProfile, signInWithEmailAndPassword } from 'firebase/auth';
import { ref, update, set, serverTimestamp } from 'firebase/database';
import { auth, db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import toast from 'react-hot-toast';

interface RegisterPromptProps {
  auctionId: string;
  isLoggedIn: boolean;
}

export default function RegisterPrompt({ auctionId, isLoggedIn }: RegisterPromptProps) {
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegisterForAuction = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await set(ref(db, `registrations/${auctionId}/${user.uid}`), {
        userId: user.uid,
        registeredAt: serverTimestamp(),
        status: 'approved',
      });
      toast.success('נרשמת למכרז בהצלחה!');
      setShowModal(false);
    } catch {
      toast.error('שגיאה בהרשמה למכרז');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
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
      // Also register for the auction immediately
      await set(ref(db, `registrations/${auctionId}/${cred.user.uid}`), {
        userId: cred.user.uid,
        registeredAt: serverTimestamp(),
        status: 'approved',
      });
      toast.success('נרשמת בהצלחה!');
      setShowModal(false);
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        toast.error('האימייל כבר רשום. נסה להתחבר');
        setMode('login');
      } else {
        toast.error('שגיאה בהרשמה');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      // Register for auction after login
      await set(ref(db, `registrations/${auctionId}/${cred.user.uid}`), {
        userId: cred.user.uid,
        registeredAt: serverTimestamp(),
        status: 'approved',
      });
      toast.success('התחברת ונרשמת למכרז!');
      setShowModal(false);
    } catch {
      toast.error('שגיאה בהתחברות. בדוק את הפרטים.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="glass rounded-xl p-4 text-center space-y-2 border border-accent/30">
        <p className="text-sm font-semibold">
          {isLoggedIn
            ? 'הירשם למכרז כדי להציע הצעות'
            : 'התחבר והירשם למכרז כדי להשתתף'}
        </p>
        {isLoggedIn ? (
          <button
            onClick={handleRegisterForAuction}
            disabled={loading}
            className="btn-accent px-6 py-2 rounded-lg text-sm disabled:opacity-50"
          >
            {loading ? 'נרשם...' : 'הירשם למכרז'}
          </button>
        ) : (
          <button
            onClick={() => setShowModal(true)}
            className="btn-accent px-6 py-2 rounded-lg text-sm"
          >
            התחבר / הירשם
          </button>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass rounded-2xl p-6 w-full max-w-md space-y-4 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-3 left-3 text-text-secondary hover:text-white text-xl"
            >
              ✕
            </button>

            <div className="text-center">
              <h2 className="text-xl font-bold">
                {mode === 'register' ? 'הרשמה למכרז' : 'התחברות'}
              </h2>
              <p className="text-text-secondary text-xs mt-1">
                {mode === 'register' ? 'צור חשבון והירשם למכרז' : 'התחבר לחשבון קיים'}
              </p>
            </div>

            {mode === 'register' ? (
              <form onSubmit={handleCreateAccount} className="space-y-3">
                <div>
                  <label className="block text-xs text-text-secondary mb-1">שם מלא</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                    className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-accent"
                    placeholder="ישראל ישראלי"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">אימייל</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-accent"
                    placeholder="your@email.com"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">טלפון</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-accent"
                    placeholder="050-1234567"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">סיסמה</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-accent"
                    placeholder="לפחות 6 תווים"
                    dir="ltr"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full btn-accent py-3 rounded-lg font-bold disabled:opacity-50"
                >
                  {loading ? 'נרשם...' : 'הירשם והצטרף למכרז'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleLogin} className="space-y-3">
                <div>
                  <label className="block text-xs text-text-secondary mb-1">אימייל</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-accent"
                    placeholder="your@email.com"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">סיסמה</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-accent"
                    placeholder="••••••••"
                    dir="ltr"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full btn-accent py-3 rounded-lg font-bold disabled:opacity-50"
                >
                  {loading ? 'מתחבר...' : 'התחבר והצטרף למכרז'}
                </button>
              </form>
            )}

            <div className="text-center text-sm text-text-secondary">
              {mode === 'register' ? (
                <>
                  יש לך חשבון?{' '}
                  <button onClick={() => setMode('login')} className="text-accent hover:underline">
                    התחבר
                  </button>
                </>
              ) : (
                <>
                  אין לך חשבון?{' '}
                  <button onClick={() => setMode('register')} className="text-accent hover:underline">
                    הירשם
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
