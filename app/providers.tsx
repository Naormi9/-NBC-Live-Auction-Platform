'use client';

import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/lib/auth-context';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      {children}
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: '#1E1E1E',
            color: '#FFFFFF',
            border: '1px solid rgba(255,255,255,0.08)',
          },
          duration: 3000,
          success: { duration: 2500 },
          error: { duration: 4000 },
        }}
        containerStyle={{ top: 16 }}
      />
    </AuthProvider>
  );
}
