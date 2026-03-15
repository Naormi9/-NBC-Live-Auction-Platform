'use client';

import { useState, useRef, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { formatPrice, getMinBid, canPlaceBid } from '@/lib/auction-utils';
import { submitBid } from '@/lib/auction-actions';
import { playBidSound } from '@/lib/sounds';
import { Auction, AuctionItem } from '@/lib/types';
import toast from 'react-hot-toast';

interface BidButtonProps {
  auction: Auction;
  item: AuctionItem;
  registered: boolean;
}

export default function BidButton({ auction, item, registered }: BidButtonProps) {
  const { user, profile } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  // Ref-based guard prevents double-clicks even before React re-renders
  const submittingRef = useRef(false);
  // Track last submitted bid to suppress duplicate toasts
  const lastBidRef = useRef<string | null>(null);

  if (!user) {
    return (
      <button disabled className="w-full py-4 rounded-xl bg-bg-elevated text-text-secondary font-semibold text-lg cursor-not-allowed">
        התחבר כדי להשתתף
      </button>
    );
  }

  if (!registered) {
    return (
      <button disabled className="w-full py-4 rounded-xl bg-bg-elevated text-text-secondary font-semibold text-lg cursor-not-allowed">
        הירשם להשתתפות
      </button>
    );
  }

  if (profile?.verificationStatus !== 'approved') {
    return (
      <button disabled className="w-full py-4 rounded-xl bg-bg-elevated text-text-secondary font-semibold text-lg cursor-not-allowed">
        החשבון ממתין לאישור
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
    // Double-click guard via ref (synchronous, before any async)
    if (submittingRef.current) return;

    const validation = canPlaceBid(user.uid, item, auction, nextBid);
    if (!validation.valid) {
      toast.error(validation.error!);
      return;
    }

    // Dedup: prevent same bid from showing multiple toasts
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
      toast.success(`הצעה של ${formatPrice(nextBid)} נשלחה!`);
    } catch (err: any) {
      // Allow retry on error
      lastBidRef.current = null;
      toast.error(err.message || 'שגיאה בשליחת ההצעה');
    } finally {
      setSubmitting(false);
      // Allow new bid after a short cooldown (prevents rapid re-clicks)
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
