'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { AuctionItem } from '@/lib/types';
import { formatPrice } from '@/lib/auction-utils';

interface CurrentItemProps {
  item: AuctionItem;
  totalItems: number;
  currentRound?: 1 | 2 | 3;
  increment?: number;
}

export default function CurrentItem({ item, totalItems, currentRound, increment }: CurrentItemProps) {
  const [activeImage, setActiveImage] = useState(0);
  const prevBidRef = useRef(item.currentBid);
  const [bidFlash, setBidFlash] = useState(false);

  // Detect bid changes and trigger flash animation
  useEffect(() => {
    if (item.currentBid !== prevBidRef.current && prevBidRef.current > 0) {
      setBidFlash(true);
      const t = setTimeout(() => setBidFlash(false), 800);
      return () => clearTimeout(t);
    }
    prevBidRef.current = item.currentBid;
  }, [item.currentBid]);

  // Reset image index when item changes
  useEffect(() => {
    setActiveImage(0);
  }, [item.id]);

  const hasImages = item.images?.length > 0;
  const images = hasImages ? item.images : [];

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Image carousel */}
      <div className="relative aspect-[16/10] bg-bg-elevated rounded-xl overflow-hidden">
        {hasImages ? (
          <Image
            src={images[activeImage]}
            alt={item.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 60vw, 50vw"
            priority
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-text-secondary text-lg">
            {item.make} {item.model} {item.year}
          </div>
        )}

        {/* Round/increment overlay */}
        {currentRound && (
          <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs font-semibold text-white">
            סיבוב {currentRound}/3{increment ? ` | קפיצה: ${formatPrice(increment)}` : ''}
          </div>
        )}

        {/* Item counter */}
        <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs font-medium text-text-secondary">
          {item.order}/{totalItems}
        </div>

        {/* Image dots */}
        {images.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveImage(i)}
                aria-label={`תמונה ${i + 1} מתוך ${images.length}`}
                className={`w-2.5 h-2.5 rounded-full transition-smooth ${
                  i === activeImage ? 'bg-white scale-110' : 'bg-white/40 hover:bg-white/60'
                }`}
              />
            ))}
          </div>
        )}

        {/* Swipe arrows for mobile */}
        {images.length > 1 && (
          <>
            <button
              onClick={() => setActiveImage((prev) => (prev > 0 ? prev - 1 : images.length - 1))}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-smooth"
              aria-label="תמונה קודמת"
            >
              ‹
            </button>
            <button
              onClick={() => setActiveImage((prev) => (prev < images.length - 1 ? prev + 1 : 0))}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-smooth"
              aria-label="תמונה הבאה"
            >
              ›
            </button>
          </>
        )}
      </div>

      {/* Item details */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl text-heading">{item.title}</h2>
          <span className="text-text-secondary text-sm">
            פריט {item.order} מתוך {totalItems}
          </span>
        </div>

        {/* Vehicle specs grid with icons */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Spec icon="📅" label="שנה" value={item.year?.toString()} />
          <Spec icon="🛣️" label='ק"מ' value={item.km?.toLocaleString()} />
          <Spec icon="👤" label="יד" value={item.owners?.toString()} />
          <Spec icon="🎨" label="צבע" value={item.color} />
          {item.engineCC && <Spec icon="⚙️" label="נפח מנוע" value={`${item.engineCC} סמ"ק`} />}
          {item.make && <Spec icon="🏭" label="יצרן" value={item.make} />}
        </div>

        {/* Price section */}
        <div
          className={`glass rounded-xl p-4 space-y-2 ${bidFlash ? 'animate-bid-flash' : ''}`}
          aria-live="polite"
          aria-atomic="true"
        >
          <div className="flex justify-between items-center text-sm text-text-secondary">
            <span>מחיר פתיחה</span>
            <span className="text-mono-nums">{formatPrice(item.openingPrice)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold">הצעה נוכחית</span>
            <span className="bid-amount text-3xl text-mono-nums">{formatPrice(item.currentBid)}</span>
          </div>
          {item.currentBidderName && (
            <div className="text-xs text-text-secondary text-left">
              מוביל: {item.currentBidderName}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Spec({ icon, label, value }: { icon: string; label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="bg-bg-elevated rounded-lg px-3 py-2 flex items-center gap-2">
      <span className="text-sm" aria-hidden="true">{icon}</span>
      <div className="min-w-0">
        <div className="text-[10px] text-text-secondary leading-none">{label}</div>
        <div className="text-sm font-medium truncate">{value}</div>
      </div>
    </div>
  );
}
