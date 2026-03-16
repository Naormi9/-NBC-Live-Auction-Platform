'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { ref, update, push, set, remove } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import * as auctionActions from '@/lib/auction-actions';
import { useAuction, useCatalog } from '@/lib/hooks';
import Navbar from '@/components/ui/Navbar';
import { AuctionStatusBadge, ItemStatusBadge } from '@/components/ui/StatusBadge';
import { formatPrice } from '@/lib/auction-utils';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import toast from 'react-hot-toast';

interface NewItemForm {
  title: string; make: string; model: string; year: string; km: string;
  color: string; engineCC: string; owners: string; openingPrice: string;
  registrationDate: string; description: string; files: FileList | null;
}

const emptyItem = (): NewItemForm => ({
  title: '', make: '', model: '', year: '', km: '',
  color: '', engineCC: '', owners: '1', openingPrice: '',
  registrationDate: '', description: '', files: null,
});

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
  // New items to add
  const [newItems, setNewItems] = useState<NewItemForm[]>([]);
  // Items to delete
  const [deletedItemIds, setDeletedItemIds] = useState<string[]>([]);

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

  const addNewItem = () => {
    setNewItems([...newItems, emptyItem()]);
  };

  const updateNewItem = (index: number, field: string, value: any) => {
    const updated = [...newItems];
    (updated[index] as any)[field] = value;
    setNewItems(updated);
  };

  const removeNewItem = (index: number) => {
    setNewItems(newItems.filter((_, i) => i !== index));
  };

  const markItemForDeletion = (itemId: string) => {
    setDeletedItemIds([...deletedItemIds, itemId]);
  };

  const unmarkItemForDeletion = (itemId: string) => {
    setDeletedItemIds(deletedItemIds.filter(id => id !== itemId));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const scheduledAt = new Date(`${date}T${time}`).getTime();
      await update(ref(db, `auctions/${auctionId}`), {
        title,
        houseName: houseName || 'מרכז המכרזים הארצי',
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

      // Save existing item changes (skip deleted ones)
      for (const [itemId, data] of Object.entries(editingItems)) {
        if (deletedItemIds.includes(itemId)) continue;
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

      // Delete items marked for deletion
      for (const itemId of deletedItemIds) {
        await remove(ref(db, `auction_items/${itemId}`));
      }

      // Determine next order number
      const existingCount = items.filter(i => !deletedItemIds.includes(i.id)).length;

      // Create new items
      for (let i = 0; i < newItems.length; i++) {
        const item = newItems[i];
        const itemRef = push(ref(db, 'auction_items'));
        await set(itemRef, {
          id: itemRef.key,
          auctionId,
          order: existingCount + i + 1,
          title: item.title || `${item.make} ${item.model} ${item.year}`.trim(),
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

      toast.success('המכרז עודכן בהצלחה!');
      setEditing(false);
      setNewItems([]);
      setDeletedItemIds([]);
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

  const visibleItems = items.filter(i => !deletedItemIds.includes(i.id));

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="glass rounded-2xl p-6">
          {editing ? (
            <div className="space-y-4">
              <h2 className="font-bold text-lg">עריכת מכרז</h2>
              <div>
                <label className="block text-sm text-text-secondary mb-1">שם המכרז</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-bg-elevated border border-border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-accent transition-smooth"
                />
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1">בית מכירות</label>
                <input
                  value={houseName}
                  onChange={(e) => setHouseName(e.target.value)}
                  className="w-full bg-bg-elevated border border-border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-accent transition-smooth"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-text-secondary mb-1">תאריך</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-bg-elevated border border-border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-accent transition-smooth"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">שעה</label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full bg-bg-elevated border border-border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-accent transition-smooth"
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
              <button onClick={() => setEditing(true)} className="bg-accent hover:bg-accent-hover text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-smooth">
                ערוך מכרז
              </button>
            )}
            {editing && (
              <>
                <button onClick={handleSave} disabled={saving} className="bg-accent hover:bg-accent-hover text-white px-5 py-2.5 rounded-xl font-semibold text-sm disabled:opacity-50 transition-smooth">
                  {saving ? 'שומר...' : 'שמור שינויים'}
                </button>
                <button onClick={() => { setEditing(false); setNewItems([]); setDeletedItemIds([]); }} className="bg-bg-elevated text-text-secondary px-5 py-2.5 rounded-xl font-semibold text-sm border border-border hover:text-white transition-smooth">
                  ביטול
                </button>
              </>
            )}
            {auction.status === 'published' && !editing && (
              <button onClick={startLive} className="bg-live-dot hover:bg-red-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-smooth">
                התחל מכרז חי
              </button>
            )}
            {auction.status === 'live' && (
              <button onClick={handleEndAuction} className="bg-timer-red hover:bg-red-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-smooth">
                סיים מכרז
              </button>
            )}
          </div>
        </div>

        {/* Round settings (edit mode only) */}
        {editing && (
          <div className="glass rounded-2xl p-6 space-y-4">
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
                className="w-32 bg-bg-elevated border border-border rounded-xl px-4 py-2 text-white focus:outline-none focus:border-accent transition-smooth"
                dir="ltr"
              />
            </div>
          </div>
        )}

        {/* Items */}
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-lg">פריטים ({visibleItems.length}{newItems.length > 0 ? ` + ${newItems.length} חדשים` : ''})</h2>
            {editing && canEdit && (
              <button
                type="button"
                onClick={addNewItem}
                className="bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-xl text-sm font-semibold transition-smooth"
              >
                + הוסף פריט
              </button>
            )}
          </div>

          <div className="space-y-3">
            {/* Existing items */}
            {items.map((item) => {
              const isDeleted = deletedItemIds.includes(item.id);
              if (isDeleted && !editing) return null;

              return (
                <div key={item.id} className={`bg-bg-elevated rounded-xl p-4 transition-smooth ${isDeleted ? 'opacity-40 border-2 border-timer-red/30' : ''}`}>
                  {editing && editingItems[item.id] && !isDeleted ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="font-semibold">פריט {item.order}</div>
                        {canEdit && item.status === 'pending' && (
                          <button
                            type="button"
                            onClick={() => markItemForDeletion(item.id)}
                            className="text-timer-red text-sm hover:underline"
                          >
                            הסר פריט
                          </button>
                        )}
                      </div>
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
                  ) : isDeleted ? (
                    <div className="flex items-center justify-between">
                      <span className="text-timer-red line-through">פריט {item.order} — {item.title}</span>
                      <button
                        type="button"
                        onClick={() => unmarkItemForDeletion(item.id)}
                        className="text-accent text-sm hover:underline"
                      >
                        בטל מחיקה
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-bg-surface flex items-center justify-center text-sm font-bold flex-shrink-0">
                          {item.order}
                        </span>
                        <div>
                          <div className="font-semibold">{item.title}</div>
                          <div className="text-sm text-text-secondary">
                            {item.year} • {item.km?.toLocaleString()} ק&quot;מ • פתיחה: {formatPrice(item.openingPrice)}
                            {item.preBidPrice && item.preBidPrice > item.openingPrice && (
                              <span className="text-bid-price mr-2">• הצעה מוקדמת: {formatPrice(item.preBidPrice)}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <ItemStatusBadge status={item.status} />
                        {item.preBidPrice && item.preBidPrice > item.openingPrice && (
                          <span className="text-bid-price font-bold text-sm">{formatPrice(item.preBidPrice)}</span>
                        )}
                        {item.soldPrice && (
                          <span className="text-bid-price font-bold">{formatPrice(item.soldPrice)}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* New items being added */}
            {newItems.map((item, i) => (
              <div key={`new-${i}`} className="bg-accent/5 border border-accent/20 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-accent">פריט חדש {i + 1}</span>
                  <button type="button" onClick={() => removeNewItem(i)} className="text-timer-red text-sm hover:underline">
                    הסר
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <SmallInput label="יצרן" value={item.make} onChange={(v) => updateNewItem(i, 'make', v)} />
                  <SmallInput label="דגם" value={item.model} onChange={(v) => updateNewItem(i, 'model', v)} />
                  <SmallInput label="שנה" value={item.year} onChange={(v) => updateNewItem(i, 'year', v)} type="number" />
                  <SmallInput label='ק"מ' value={item.km} onChange={(v) => updateNewItem(i, 'km', v)} type="number" />
                  <SmallInput label="צבע" value={item.color} onChange={(v) => updateNewItem(i, 'color', v)} />
                  <SmallInput label="נפח מנוע" value={item.engineCC} onChange={(v) => updateNewItem(i, 'engineCC', v)} type="number" />
                  <SmallInput label="יד" value={item.owners} onChange={(v) => updateNewItem(i, 'owners', v)} type="number" />
                  <SmallInput label="מחיר פתיחה (₪)" value={item.openingPrice} onChange={(v) => updateNewItem(i, 'openingPrice', v)} type="number" />
                </div>
                <SmallInput label="תיאור" value={item.description} onChange={(v) => updateNewItem(i, 'description', v)} full />
                <div>
                  <label className="text-xs text-text-secondary">תמונות רכב (עד 5)</label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      if (e.target.files) {
                        updateNewItem(i, 'files', e.target.files);
                      }
                    }}
                    className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-white text-sm file:mr-3 file:bg-accent/20 file:text-accent file:border-0 file:rounded file:px-2 file:py-1 file:text-xs"
                  />
                </div>
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
    <div className="bg-bg-elevated rounded-xl p-4 space-y-3">
      <div className="text-sm font-semibold">{label}</div>
      <div>
        <label className="text-xs text-text-secondary">מדרגת קפיצה (₪)</label>
        <input
          type="number"
          value={inc}
          onChange={(e) => setInc(parseInt(e.target.value))}
          className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent transition-smooth"
          dir="ltr"
        />
      </div>
      <div>
        <label className="text-xs text-text-secondary">טיימר (שניות)</label>
        <input
          type="number"
          value={timer}
          onChange={(e) => setTimer(parseInt(e.target.value))}
          className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent transition-smooth"
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
        className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent transition-smooth"
        dir={type === 'number' ? 'ltr' : undefined}
      />
    </div>
  );
}
