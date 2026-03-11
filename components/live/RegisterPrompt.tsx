'use client';

import Link from 'next/link';

interface RegisterPromptProps {
  auctionId: string;
  isLoggedIn: boolean;
}

export default function RegisterPrompt({ auctionId, isLoggedIn }: RegisterPromptProps) {
  return (
    <div className="glass rounded-xl p-4 text-center space-y-2 border border-accent/30">
      <p className="text-sm font-semibold">
        {isLoggedIn
          ? 'נרשם למכרז כדי להציע הצעות'
          : 'התחבר והירשם למכרז כדי להשתתף'}
      </p>
      {isLoggedIn ? (
        <Link
          href={`/auctions/${auctionId}`}
          className="inline-block btn-accent px-6 py-2 rounded-lg text-sm"
        >
          עבור לדף ההרשמה
        </Link>
      ) : (
        <Link
          href="/login"
          className="inline-block btn-accent px-6 py-2 rounded-lg text-sm"
        >
          התחבר
        </Link>
      )}
    </div>
  );
}
