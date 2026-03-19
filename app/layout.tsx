import type { Metadata } from 'next';
import { Heebo, Rubik } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  variable: '--font-heebo',
  display: 'swap',
});

const rubik = Rubik({
  subsets: ['hebrew', 'latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-rubik',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'מכרזי מיכאלי מוטורס | Michaeli Motors Auction',
  description: 'מכרזי רכבים חיים של מיכאלי מוטורס — הציעו מחיר, השתתפו בלייב וקנו רכב במחיר שאתם קובעים',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.svg',
    apple: '/logo-icon.svg',
  },
  other: {
    'theme-color': '#080F0F',
    'msapplication-TileColor': '#080F0F',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} ${rubik.variable}`}>
      <body className="font-heebo bg-bg-primary text-text-primary min-h-screen antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
