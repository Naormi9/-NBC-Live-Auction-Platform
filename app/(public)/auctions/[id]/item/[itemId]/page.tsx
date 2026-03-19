'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '@/lib/firebase';
import { AuctionItem } from '@/lib/types';
import { formatPrice } from '@/lib/auction-utils';
import Image from 'next/image';
import Navbar from '@/components/ui/Navbar';
import { ItemStatusBadge } from '@/components/ui/StatusBadge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function ItemDetailPage() {
  const params = useParams();
  const itemId = params.itemId as string;
  const [item, setItem] = useState<AuctionItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const itemRef = ref(db, `auction_items/${itemId}`);
    const unsub = onValue(itemRef, (snap) => {
      if (snap.exists()) {
        setItem({ ...snap.val(), id: itemId });
      }
      setLoading(false);
    });
    return () => unsub();
  }, [itemId]);

  if (loading) return <><Navbar /><LoadingSpinner size="lg" /></>;
  if (!item) return <><Navbar /><div className="text-center py-20 text-text-secondary">פריט לא נמצא</div></>;

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Images */}
        <div className="aspect-video bg-bg-elevated rounded-xl overflow-hidden relative">
          {item.images?.[0] ? (
            <Image src={item.images[0]} alt={item.title} fill className="object-cover" sizes="(max-width: 768px) 100vw, 768px" priority />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-text-secondary">
              {item.make} {item.model} {item.year}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <ItemStatusBadge status={item.status} />
          <span className="text-sm text-text-secondary">פריט {item.order}</span>
        </div>

        <h1 className="text-3xl font-bold">{item.title}</h1>
        {item.description && <p className="text-text-secondary">{item.description}</p>}

        {/* Specs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Spec label="יצרן" value={item.make} />
          <Spec label="דגם" value={item.model} />
          <Spec label="שנה" value={item.year?.toString()} />
          <Spec label='ק"מ' value={item.km?.toLocaleString()} />
          <Spec label="צבע" value={item.color} />
          <Spec label='נפח מנוע' value={item.engineCC ? `${item.engineCC} סמ"ק` : undefined} />
          <Spec label="יד" value={item.owners?.toString()} />
          <Spec label="רישום ראשון" value={item.registrationDate} />
        </div>

        {/* Prices */}
        <div className="glass rounded-xl p-6 space-y-3">
          <div className="flex justify-between">
            <span className="text-text-secondary">מחיר פתיחה</span>
            <span className="font-bold">{formatPrice(item.openingPrice)}</span>
          </div>
          {item.currentBid > 0 && item.currentBid !== item.openingPrice && (
            <div className="flex justify-between">
              <span className="text-text-secondary">הצעה נוכחית</span>
              <span className="bid-amount">{formatPrice(item.currentBid)}</span>
            </div>
          )}
          {item.soldPrice && (
            <div className="flex justify-between">
              <span className="text-text-secondary">מחיר סופי</span>
              <span className="text-bid-price font-bold text-xl">{formatPrice(item.soldPrice)}</span>
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
    <div className="bg-bg-elevated rounded-lg px-4 py-3">
      <div className="text-xs text-text-secondary">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
