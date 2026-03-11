'use client';

import { useState } from 'react';
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

  const placeholderImages = [
    `https://placehold.co/800x500/1E1E1E/6C63FF?text=${encodeURIComponent(item.title)}`,
  ];
  const images = item.images?.length > 0 ? item.images : placeholderImages;

  return (
    <div className="space-y-4">
      {/* Image carousel */}
      <div className="relative aspect-[16/10] bg-bg-elevated rounded-xl overflow-hidden">
        <img
          src={images[activeImage]}
          alt={item.title}
          className="w-full h-full object-cover"
        />
        {currentRound && (
          <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs font-semibold text-white">
            סיבוב {currentRound}/3{increment ? ` | קפיצה: ${formatPrice(increment)}` : ''}
          </div>
        )}
        {images.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveImage(i)}
                className={`w-2 h-2 rounded-full transition-smooth ${
                  i === activeImage ? 'bg-white' : 'bg-white/40'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Item details */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">{item.title}</h2>
          <span className="text-text-secondary text-sm">
            פריט {item.order} מתוך {totalItems}
          </span>
        </div>

        {/* Vehicle specs grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Spec label="שנה" value={item.year?.toString()} />
          <Spec label='ק"מ' value={item.km?.toLocaleString()} />
          <Spec label="יד" value={item.owners?.toString()} />
          <Spec label="צבע" value={item.color} />
          {item.engineCC && <Spec label="נפח מנוע" value={`${item.engineCC} סמ"ק`} />}
          {item.make && <Spec label="יצרן" value={item.make} />}
        </div>

        {/* Price section */}
        <div className="glass rounded-xl p-4 space-y-2">
          <div className="flex justify-between items-center text-sm text-text-secondary">
            <span>מחיר פתיחה</span>
            <span>{formatPrice(item.openingPrice)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold">הצעה נוכחית</span>
            <span className="bid-amount text-3xl">{formatPrice(item.currentBid)}</span>
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

function Spec({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="bg-bg-elevated rounded-lg px-3 py-2">
      <div className="text-xs text-text-secondary">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}
