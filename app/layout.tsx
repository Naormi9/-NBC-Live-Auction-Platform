import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

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
    <html lang="he" dir="rtl">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-heebo bg-bg-primary text-text-primary min-h-screen">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
