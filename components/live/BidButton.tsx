'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { formatPrice, getMinBid, canPlaceBid } from '@/lib/auction-utils';
import { submitBid } from '@/lib/auction-actions';
import { playBidSound } from '@/lib/sounds';
import { Auction, AuctionItem } from '@/lib/types';
import toast from 'react-hot-toast';
import Link from 'next/link';

interface BidButtonProps {
  auction: Auction;
  item: AuctionItem;
  registered: boolean;
}

export default function BidButton({ auction, item, registered }: BidButtonProps) {
  const { user, profile } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const lastBidRef = useRef<string | null>(null);

  // Clear dedup ref when item or round changes so user can bid on new context
  useEffect(() => {
    lastBidRef.current = null;
  }, [item.id, auction.currentRound]);

  if (!user) {
    return (
      <Link href="/login?redirect=/live" className="block w-full py-4 rounded-xl bg-bg-elevated text-center text-accent font-semibold text-lg hover:bg-bg-elevated/80 transition-smooth">
        התחבר כדי להשתתף
      </Link>
    );
  }

  if (profile?.verificationStatus === 'pending_verification') {
    return (
      <Link href="/verify" className="block w-full py-4 rounded-xl bg-accent/20 text-center text-accent font-semibold text-lg border border-accent/30 hover:bg-accent/30 transition-smooth">
        השלם אימות כדי להציע
      </Link>
    );
  }

  if (profile?.verificationStatus === 'pending_approval') {
    return (
      <button disabled className="w-full py-4 rounded-xl bg-yellow-500/10 text-yellow-400 font-semibold text-lg cursor-not-allowed border border-yellow-500/20">
        החשבון ממתין לאישור
      </button>
    );
  }

  if (profile?.verificationStatus === 'rejected') {
    return (
      <button disabled className="w-full py-4 rounded-xl bg-red-500/10 text-red-400 font-semibold text-lg cursor-not-allowed border border-red-500/20">
        החשבון נדחה — פנה לתמיכה
      </button>
    );
  }

  if (!registered) {
    return (
      <button disabled className="w-full py-4 rounded-xl bg-bg-elevated text-text-secondary font-semibold text-lg cursor-not-allowed">
        ממתין לרישום...
      </button>
    );
  }

  if (auction.status === 'ended' || item.status === 'sold' || item.status === 'unsold') {
    return (
      <button disabled className="w-full py-4 rounded-xl bg-bg-elevated text-text-secondary font-semibold text-lg cursor-not-allowed">
        {item.status === 'sold' ? 'הפריט נמכר' : item.status === 'unsold' ? 'הפריט לא נמכר' : 'המכרז הסתיים'}
      </button>
    );
  }

  if (item.currentBidderId === user.uid) {
    return (
      <button disabled className="w-full py-4 rounded-xl bg-bid-price/20 text-bid-price font-semibold text-lg cursor-not-allowed border border-bid-price/30">
        אתה המציע המוביל ✓
      </button>
    );
  }

  const nextBid = getMinBid(item.currentBid, auction.settings, auction.currentRound);

  const handleBid = useCallback(async () => {
    if (submittingRef.current) return;

    const validation = canPlaceBid(user.uid, item, auction, nextBid);
    if (!validation.valid) {
      toast.error(validation.error!, { id: 'bid-validation' });
      return;
    }

    const bidKey = `${item.id}-${nextBid}-${auction.currentRound}`;
    if (lastBidRef.current === bidKey) return;

    submittingRef.current = true;
    lastBidRef.current = bidKey;
    setSubmitting(true);
    try {
      await submitBid(
        auction.id,
        item.id,
        user.uid,
        user.displayName || 'משתתף',
        nextBid,
        auction.currentRound as 1 | 2 | 3
      );
      playBidSound();
      toast.success(`הצעה של ${formatPrice(nextBid)} נשלחה!`, { id: `bid-${bidKey}` });
    } catch (err: any) {
      lastBidRef.current = null;
      toast.error(err.message || 'שגיאה בשליחת ההצעה', { id: 'bid-error' });
    } finally {
      setSubmitting(false);
      setTimeout(() => { submittingRef.current = false; }, 1500);
    }
  }, [user, item, auction, nextBid]);

  return (
    <button
      onClick={handleBid}
      disabled={submitting}
      className={`w-full py-5 rounded-xl font-black text-xl transition-smooth
        brand-gradient shadow-lg shadow-[#433BFF]/30
        active:scale-[0.98] transition-transform
        text-white disabled:opacity-50`}
    >
      {submitting ? 'שולח...' : `הצע ${formatPrice(nextBid)} ↑`}
    </button>
  );
}
