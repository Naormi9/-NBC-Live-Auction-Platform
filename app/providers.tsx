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
            background: '#151D22',
            color: '#F0F0F0',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
            borderRadius: '12px',
            fontSize: '14px',
            fontFamily: 'var(--font-heebo), Heebo, sans-serif',
          },
          duration: 3000,
          success: {
            duration: 2500,
            iconTheme: { primary: '#00D4AA', secondary: '#070E10' },
          },
          error: {
            duration: 4000,
            iconTheme: { primary: '#F43F5E', secondary: '#070E10' },
          },
        }}
        containerStyle={{ top: 16 }}
      />
    </AuthProvider>
  );
}
