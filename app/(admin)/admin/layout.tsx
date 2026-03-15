'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { isAllowedAdmin } from '@/lib/admin-allowlist';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  const isAdmin = user && isAllowedAdmin(user.email) &&
    (profile?.role === 'admin' || profile?.role === 'house_manager');

  useEffect(() => {
    if (loading) return;
    if (!user || !isAdmin) {
      router.push('/login');
    }
  }, [user, isAdmin, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user || !isAdmin) return null;

  return <>{children}</>;
}
