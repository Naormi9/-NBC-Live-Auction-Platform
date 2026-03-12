'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { ref, update } from 'firebase/database';
import { db } from '@/lib/firebase';
import * as auctionActions from '@/lib/auction-actions';
import { useAuction, useCatalog } from '@/lib/hooks';
import Navbar from '@/components/ui/Navbar';
import { AuctionStatusBadge, ItemStatusBadge } from '@/components/ui/StatusBadge';
import { formatPrice } from '@/lib/auction-utils';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import toast from 'react-hot-toast';

export default function EditAuctionPage() {
  const params = useParams();
  const auctionId = params.id as string;
  const { auction, loading: auctionLoading } = useAuction(auctionId);
  const { items, loading: itemsLoading } = useCatalog(auctionId);
  const [editing, setEditing] = useState(false);

  // Edit state
  const [title, setTitle] = useState('');
  const [houseName, setHouseName] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [preBids, setPreBids] = useState(true);
  const [r1Inc, setR1Inc] = useState(1000);
  const [r1Timer, setR1Timer] = useState(45);
  const [r2Inc, setR2Inc] = useState(500);
  const [r2Timer, setR2Timer] = useState(30);
  const [r3Inc, setR3Inc] = useState(250);
  const [r3Timer, setR3Timer] = useState(30);
  const [hardClose, setHardClose] = useState(30);
  const [saving, setSaving] = useState(false);

  // Item edit state
  const [editingItems, setEditingItems] = useState<Record<string, any>>({});

  // Populate form when auction loads
  useEffect(() => {
    if (!auction) return;
    setTitle(auction.title || '');
    setHouseName(auction.houseName || '');
    setPreBids(auction.preBidsEnabled ?? true);
    if (auction.scheduledAt) {
      const d = new Date(auction.scheduledAt);
      setDate(d.toISOString().split('T')[0]);
      setTime(d.toTimeString().slice(0, 5));
    }
    if (auction.settings) {
      setR1Inc(auction.settings.round1?.increment || 1000);
      setR1Timer(auction.settings.round1?.timerSeconds || 45);
      setR2Inc(auction.settings.round2?.increment || 500);
      setR2Timer(auction.settings.round2?.timerSeconds || 30);
      setR3Inc(auction.settings.round3?.increment || 250);
      setR3Timer(auction.settings.round3?.timerSeconds || 30);
      setHardClose(auction.settings.hardCloseMinutes || 30);
    }
  }, [auction]);

  // Populate items for editing
  useEffect(() => {
    if (!items.length) return;
    const itemsMap: Record<string, any> = {};
    items.forEach((item) => {
      itemsMap[item.id] = {
        make: item.make || '',
        model: item.model || '',
        year: String(item.year || ''),
        km: String(item.km || ''),
        color: item.color || '',
        engineCC: String(item.engineCC || ''),
        owners: String(item.owners || '1'),
        openingPrice: String(item.openingPrice || ''),
        description: item.description || '',
      };
    });
    setEditingItems(itemsMap);
  }, [items]);

  if (auctionLoading || itemsLoading) return <><Navbar /><LoadingSpinner size="lg" /></>;
  if (!auction) return <><Navbar /><div className="text-center py-20 text-text-secondary">מכרז לא נמצא</div></>;

  const canEdit = auction.status === 'published' || auction.status === 'draft';

  const startLive = async () => {
    try {
      const msg = await auctionActions.startAuctionLive(auctionId);
      toast.success(msg);
    } catch (err: any) {
      toast.error(err.message || 'שגיאה בהפעלת המכרז');
    }
  };

  const handleEndAuction = async () => {
    try {
      const msg = await auctionActions.endAuction(auctionId);
      toast.success(msg);
    } catch (err: any) {
      toast.error(err.message || 'שגיאה בסיום המכרז');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const scheduledAt = new Date(`${date}T${time}`).getTime();
      await update(ref(db, `auctions/${auctionId}`), {
        title,
        houseName: houseName || 'NBC מכרזים',
        scheduledAt,
        preBidsEnabled: preBids,
        timerDuration: r1Timer,
        settings: {
          round1: { increment: r1Inc, timerSeconds: r1Timer },
          round2: { increment: r2Inc, timerSeconds: r2Timer },
          round3: { increment: r3Inc, timerSeconds: r3Timer },
          hardCloseMinutes: hardClose,
        },
      });

      // Save item changes
      for (const [itemId, data] of Object.entries(editingItems)) {
        await update(ref(db, `auction_items/${itemId}`), {
          title: `${data.make} ${data.model} ${data.year}`.trim(),
          make: data.make,
          model: data.model,
          year: parseInt(data.year) || 0,
          km: parseInt(data.km) || 0,
          color: data.color,
          engineCC: parseInt(data.engineCC) || 0,
          owners: parseInt(data.owners) || 1,
          openingPrice: parseInt(data.openingPrice) || 0,
          description: data.description,
        });
      }

      toast.success('המכרז עודכן בהצלחה!');
      setEditing(false);
    } catch (err) {
      toast.error('שגיאה בעדכון המכרז');
    } finally {
      setSaving(false);
    }
  };

  const updateItemField = (itemId: string, field: string, value: string) => {
    setEditingItems((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], [field]: value },
    }));
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="glass rounded-xl p-6">
          {editing ? (
            <div className="space-y-4">
              <h2 className="font-bold text-lg">עריכת מכרז</h2>
              <div>
                <label className="block text-sm text-text-secondary mb-1">שם המכרז</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-bg-elevated border border-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1">בית מכירות</label>
                <input
                  value={houseName}
                  onChange={(e) => setHouseName(e.target.value)}
                  className="w-full bg-bg-elevated border border-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-accent"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-text-secondary mb-1">תאריך</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
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
          ) : (
            <>
              <div className="flex items-center gap-3 mb-3">
                <AuctionStatusBadge status={auction.status} />
                <h1 className="text-2xl font-bold">{auction.title}</h1>
              </div>
              <p className="text-text-secondary">{auction.houseName}</p>
              <p className="text-sm text-text-secondary mt-1">
                {new Date(auction.scheduledAt).toLocaleDateString('he-IL')} בשעה{' '}
                {new Date(auction.scheduledAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </>
          )}

          <div className="flex gap-3 mt-4">
            {canEdit && !editing && (
              <button onClick={() => setEditing(true)} className="bg-accent text-white px-4 py-2 rounded-lg font-semibold text-sm">
                ערוך מכרז
              </button>
            )}
            {editing && (
              <>
                <button onClick={handleSave} disabled={saving} className="bg-accent text-white px-4 py-2 rounded-lg font-semibold text-sm disabled:opacity-50">
                  {saving ? 'שומר...' : 'שמור שינויים'}
                </button>
                <button onClick={() => setEditing(false)} className="bg-bg-elevated text-text-secondary px-4 py-2 rounded-lg font-semibold text-sm">
                  ביטול
                </button>
              </>
            )}
            {auction.status === 'published' && !editing && (
              <button onClick={startLive} className="bg-live-dot text-white px-4 py-2 rounded-lg font-semibold text-sm">
                התחל מכרז חי
              </button>
            )}
            {auction.status === 'live' && (
              <button onClick={handleEndAuction} className="bg-timer-red text-white px-4 py-2 rounded-lg font-semibold text-sm">
                סיים מכרז
              </button>
            )}
          </div>
        </div>

        {/* Round settings (edit mode only) */}
        {editing && (
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
        )}

        {/* Items */}
        <div className="glass rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold">פריטים ({items.length})</h2>
          </div>
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="bg-bg-elevated rounded-lg p-4">
                {editing && editingItems[item.id] ? (
                  <div className="space-y-3">
                    <div className="font-semibold mb-2">פריט {item.order}</div>
                    <div className="grid grid-cols-2 gap-3">
                      <SmallInput label="יצרן" value={editingItems[item.id].make} onChange={(v) => updateItemField(item.id, 'make', v)} />
                      <SmallInput label="דגם" value={editingItems[item.id].model} onChange={(v) => updateItemField(item.id, 'model', v)} />
                      <SmallInput label="שנה" value={editingItems[item.id].year} onChange={(v) => updateItemField(item.id, 'year', v)} type="number" />
                      <SmallInput label='ק"מ' value={editingItems[item.id].km} onChange={(v) => updateItemField(item.id, 'km', v)} type="number" />
                      <SmallInput label="צבע" value={editingItems[item.id].color} onChange={(v) => updateItemField(item.id, 'color', v)} />
                      <SmallInput label="נפח מנוע" value={editingItems[item.id].engineCC} onChange={(v) => updateItemField(item.id, 'engineCC', v)} type="number" />
                      <SmallInput label="יד" value={editingItems[item.id].owners} onChange={(v) => updateItemField(item.id, 'owners', v)} type="number" />
                      <SmallInput label="מחיר פתיחה (₪)" value={editingItems[item.id].openingPrice} onChange={(v) => updateItemField(item.id, 'openingPrice', v)} type="number" />
                    </div>
                    <SmallInput label="תיאור" value={editingItems[item.id].description} onChange={(v) => updateItemField(item.id, 'description', v)} full />
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-bg-surface flex items-center justify-center text-sm font-bold">
                        {item.order}
                      </span>
                      <div>
                        <div className="font-semibold">{item.title}</div>
                        <div className="text-sm text-text-secondary">
                          {item.year} • {item.km?.toLocaleString()} ק&quot;מ • פתיחה: {formatPrice(item.openingPrice)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <ItemStatusBadge status={item.status} />
                      {item.soldPrice && (
                        <span className="text-bid-price font-bold">{formatPrice(item.soldPrice)}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
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

function SmallInput({ label, value, onChange, type = 'text', full = false }: {
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
