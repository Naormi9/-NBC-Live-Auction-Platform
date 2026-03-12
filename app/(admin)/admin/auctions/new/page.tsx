'use client';

import { useState } from 'react';
import { ref, push, set, get, update, serverTimestamp } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/ui/Navbar';
import { DEFAULT_AUCTION_SETTINGS } from '@/lib/auction-utils';
import toast from 'react-hot-toast';

interface ItemForm {
  title: string; make: string; model: string; year: string; km: string;
  color: string; engineCC: string; owners: string; openingPrice: string;
  registrationDate: string; description: string; files: FileList | null;
}

const uploadImages = async (files: FileList, itemId: string): Promise<string[]> => {
  const urls: string[] = [];
  for (let i = 0; i < Math.min(files.length, 5); i++) {
    const file = files[i];
    const fileRef = storageRef(storage, `auction_items/${itemId}/${Date.now()}_${file.name}`);
    await uploadBytes(fileRef, file);
    const url = await getDownloadURL(fileRef);
    urls.push(url);
  }
  return urls;
};

export default function NewAuctionPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [houseName, setHouseName] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [preBids, setPreBids] = useState(true);
  const [loading, setLoading] = useState(false);

  // Round settings
  const [r1Inc, setR1Inc] = useState(1000);
  const [r1Timer, setR1Timer] = useState(45);
  const [r2Inc, setR2Inc] = useState(500);
  const [r2Timer, setR2Timer] = useState(30);
  const [r3Inc, setR3Inc] = useState(250);
  const [r3Timer, setR3Timer] = useState(30);
  const [hardClose, setHardClose] = useState(30);

  // Items
  const [items, setItems] = useState<ItemForm[]>([]);

  const addItem = () => {
    setItems([...items, {
      title: '', make: '', model: '', year: '', km: '',
      color: '', engineCC: '', owners: '1', openingPrice: '',
      registrationDate: '', description: '', files: null,
    }]);
  };

  const updateItem = (index: number, field: string, value: any) => {
    const updated = [...items];
    (updated[index] as any)[field] = value;
    setItems(updated);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const saveAuction = async (status: 'draft' | 'published') => {
    if (!title) {
      toast.error('הכנס שם מכרז');
      return;
    }
    if (status === 'published' && (!date || !time)) {
      toast.error('מלא תאריך ושעה לפני פרסום');
      return;
    }
    setLoading(true);
    try {
      const scheduledAt = date && time ? new Date(`${date}T${time}`).getTime() : 0;

      // Check for conflicting auctions on the same date
      if (status === 'published' && scheduledAt > 0) {
        const allSnap = await get(ref(db, 'auctions'));
        if (allSnap.exists()) {
          const all = allSnap.val();
          const sameDayConflict = Object.values(all).some((a: any) => {
            if (a.status === 'ended' || a.status === 'draft') return false;
            const diff = Math.abs(a.scheduledAt - scheduledAt);
            return diff < 3 * 60 * 60 * 1000; // within 3 hours
          });
          if (sameDayConflict) {
            toast.error('יש מכרז מתוכנן בזמן קרוב. לא ניתן ליצור שני מכרזים בו-זמנית.');
            setLoading(false);
            return;
          }
        }
      }

      const auctionRef = push(ref(db, 'auctions'));
      const auctionId = auctionRef.key!;

      await set(auctionRef, {
        id: auctionId,
        title,
        houseId: 'default',
        houseName: houseName || 'NBC מכרזים',
        scheduledAt,
        status,
        preBidsEnabled: preBids,
        currentItemId: null,
        currentRound: 1,
        timerEndsAt: 0,
        timerDuration: r1Timer,
        viewerCount: 0,
        settings: {
          round1: { increment: r1Inc, timerSeconds: r1Timer },
          round2: { increment: r2Inc, timerSeconds: r2Timer },
          round3: { increment: r3Inc, timerSeconds: r3Timer },
          hardCloseMinutes: hardClose,
        },
      });

      // Create items
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const itemRef = push(ref(db, 'auction_items'));
        await set(itemRef, {
          id: itemRef.key,
          auctionId,
          order: i + 1,
          title: item.title || `${item.make} ${item.model} ${item.year}`,
          description: item.description,
          images: [],
          openingPrice: parseInt(item.openingPrice) || 0,
          currentBid: parseInt(item.openingPrice) || 0,
          currentBidderId: null,
          currentBidderName: null,
          preBidPrice: null,
          status: 'pending',
          soldAt: null,
          soldPrice: null,
          make: item.make,
          model: item.model,
          year: parseInt(item.year) || 0,
          km: parseInt(item.km) || 0,
          color: item.color,
          engineCC: parseInt(item.engineCC) || 0,
          owners: parseInt(item.owners) || 1,
          registrationDate: item.registrationDate,
        });

        // Upload images if provided
        if (item.files && item.files.length > 0) {
          const imageUrls = await uploadImages(item.files, itemRef.key!);
          await update(ref(db, `auction_items/${itemRef.key}`), { images: imageUrls });
        }
      }

      toast.success(status === 'draft' ? 'הטיוטה נשמרה!' : 'המכרז נוצר ופורסם!');
      router.push('/admin/auctions');
    } catch (err) {
      toast.error('שגיאה ביצירת המכרז');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveAuction('published');
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">מכרז חדש</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic info */}
          <div className="glass rounded-xl p-6 space-y-4">
            <h2 className="font-bold">פרטי מכרז</h2>
            <div>
              <label className="block text-sm text-text-secondary mb-1">שם המכרז</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full bg-bg-elevated border border-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-accent"
                placeholder='מכרז רכבים מרץ 2026 חלק א&apos;'
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">בית מכירות</label>
              <input
                value={houseName}
                onChange={(e) => setHouseName(e.target.value)}
                className="w-full bg-bg-elevated border border-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-accent"
                placeholder="NBC מכרזים"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-text-secondary mb-1">תאריך</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full bg-bg-elevated border border-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-accent"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1">שעה</label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  required
                  className="w-full bg-bg-elevated border border-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-accent"
                  dir="ltr"
                />
              </div>
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={preBids}
                onChange={(e) => setPreBids(e.target.checked)}
                className="w-5 h-5 rounded accent-accent"
              />
              <span>אפשר הצעות מוקדמות</span>
            </label>
          </div>

          {/* Round settings */}
          <div className="glass rounded-xl p-6 space-y-4">
            <h2 className="font-bold">הגדרות סיבובים</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <RoundSetting label="סיבוב 1" inc={r1Inc} setInc={setR1Inc} timer={r1Timer} setTimer={setR1Timer} />
              <RoundSetting label="סיבוב 2" inc={r2Inc} setInc={setR2Inc} timer={r2Timer} setTimer={setR2Timer} />
              <RoundSetting label="סיבוב 3" inc={r3Inc} setInc={setR3Inc} timer={r3Timer} setTimer={setR3Timer} />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">סגירה קשיחה (דקות)</label>
              <input
                type="number"
                value={hardClose}
                onChange={(e) => setHardClose(parseInt(e.target.value))}
                className="w-32 bg-bg-elevated border border-border rounded-lg px-4 py-2 text-white focus:outline-none focus:border-accent"
                dir="ltr"
              />
            </div>
          </div>

          {/* Items */}
          <div className="glass rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">פריטים ({items.length})</h2>
              <button type="button" onClick={addItem} className="btn-accent px-3 py-1.5 rounded-lg text-sm">
                + הוסף פריט
              </button>
            </div>
            {items.map((item, i) => (
              <div key={i} className="bg-bg-elevated rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">פריט {i + 1}</span>
                  <button type="button" onClick={() => removeItem(i)} className="text-timer-red text-sm">
                    הסר
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input label="יצרן" value={item.make} onChange={(v) => updateItem(i, 'make', v)} />
                  <Input label="דגם" value={item.model} onChange={(v) => updateItem(i, 'model', v)} />
                  <Input label="שנה" value={item.year} onChange={(v) => updateItem(i, 'year', v)} type="number" />
                  <Input label='ק"מ' value={item.km} onChange={(v) => updateItem(i, 'km', v)} type="number" />
                  <Input label="צבע" value={item.color} onChange={(v) => updateItem(i, 'color', v)} />
                  <Input label="נפח מנוע" value={item.engineCC} onChange={(v) => updateItem(i, 'engineCC', v)} type="number" />
                  <Input label="יד" value={item.owners} onChange={(v) => updateItem(i, 'owners', v)} type="number" />
                  <Input label="מחיר פתיחה (₪)" value={item.openingPrice} onChange={(v) => updateItem(i, 'openingPrice', v)} type="number" />
                </div>
                <Input label="תיאור" value={item.description} onChange={(v) => updateItem(i, 'description', v)} full />
                <div className="col-span-2">
                  <label className="text-xs text-text-secondary">תמונות רכב (עד 5)</label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      if (e.target.files) {
                        updateItem(i, 'files', e.target.files);
                      }
                    }}
                    className="w-full bg-bg-primary border border-border rounded px-3 py-2 text-white text-sm file:mr-3 file:bg-accent/20 file:text-accent file:border-0 file:rounded file:px-2 file:py-1 file:text-xs"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              disabled={loading}
              onClick={() => saveAuction('draft')}
              className="flex-1 btn-dark py-4 rounded-xl text-lg font-bold disabled:opacity-50 border border-border"
            >
              {loading ? 'שומר...' : 'שמור כטיוטה'}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 btn-accent py-4 rounded-xl text-lg font-bold disabled:opacity-50"
            >
              {loading ? 'יוצר מכרז...' : 'צור ופרסם'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RoundSetting({ label, inc, setInc, timer, setTimer }: {
  label: string; inc: number; setInc: (n: number) => void; timer: number; setTimer: (n: number) => void;
}) {
  return (
    <div className="bg-bg-elevated rounded-lg p-3 space-y-2">
      <div className="text-sm font-semibold">{label}</div>
      <div>
        <label className="text-xs text-text-secondary">מדרגת קפיצה (₪)</label>
        <input
          type="number"
          value={inc}
          onChange={(e) => setInc(parseInt(e.target.value))}
          className="w-full bg-bg-primary border border-border rounded px-2 py-1 text-white text-sm"
          dir="ltr"
        />
      </div>
      <div>
        <label className="text-xs text-text-secondary">טיימר (שניות)</label>
        <input
          type="number"
          value={timer}
          onChange={(e) => setTimer(parseInt(e.target.value))}
          className="w-full bg-bg-primary border border-border rounded px-2 py-1 text-white text-sm"
          dir="ltr"
        />
      </div>
    </div>
  );
}

function Input({ label, value, onChange, type = 'text', full = false }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; full?: boolean;
}) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <label className="text-xs text-text-secondary">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-bg-primary border border-border rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-accent"
        dir={type === 'number' ? 'ltr' : undefined}
      />
    </div>
  );
}
