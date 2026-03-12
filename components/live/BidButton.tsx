'use client';

import { useState } from 'react';
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
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [justOutbid, setJustOutbid] = useState(false);

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

  const handleBid = async () => {
    if (submitting) return;

    const validation = canPlaceBid(user.uid, item, auction, nextBid);
    if (!validation.valid) {
      toast.error(validation.error!);
      return;
    }

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
      toast.error(err.message || 'שגיאה בשליחת ההצעה');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <button
      onClick={handleBid}
      disabled={submitting}
      className={`w-full py-4 rounded-xl font-bold text-lg transition-smooth
        ${justOutbid ? 'bg-accent border-2 border-timer-red animate-pulse' : 'bg-accent hover:bg-accent-hover'}
        text-white disabled:opacity-50`}
    >
      {submitting ? 'שולח...' : `הצע ${formatPrice(nextBid)} ↑`}
    </button>
  );
}
