'use client';

import { useState, useEffect } from 'react';
import { ref, onValue, push, set, update, serverTimestamp } from 'firebase/database';
import { db } from '@/lib/firebase';
import Navbar from '@/components/ui/Navbar';
import toast from 'react-hot-toast';
import type { UserRole } from '@/lib/types';

interface House {
  id: string;
  name: string;
  createdAt: number;
}

interface UserEntry {
  id: string;
  displayName: string;
  email: string;
  role: UserRole;
  houseId: string | null;
}

export default function AdminHousesPage() {
  const [houses, setHouses] = useState<House[]>([]);
  const [users, setUsers] = useState<UserEntry[]>([]);
  const [newHouseName, setNewHouseName] = useState('');
  const [loadingHouses, setLoadingHouses] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [savingHouse, setSavingHouse] = useState(false);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);

  // Track pending role/house changes per user
  const [pendingChanges, setPendingChanges] = useState<
    Record<string, { role?: UserRole; houseId?: string | null }>
  >({});

  // Fetch houses
  useEffect(() => {
    const housesRef = ref(db, 'houses');
    const unsub = onValue(housesRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setHouses([]);
        setLoadingHouses(false);
        return;
      }
      const list: House[] = Object.entries(data).map(([id, val]: [string, any]) => ({
        id,
        name: val.name,
        createdAt: val.createdAt,
      }));
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setHouses(list);
      setLoadingHouses(false);
    });
    return () => unsub();
  }, []);

  // Fetch users
  useEffect(() => {
    const usersRef = ref(db, 'users');
    const unsub = onValue(usersRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setUsers([]);
        setLoadingUsers(false);
        return;
      }
      const list: UserEntry[] = Object.entries(data).map(([id, val]: [string, any]) => ({
        id,
        displayName: val.displayName || '',
        email: val.email || '',
        role: val.role || 'participant',
        houseId: val.houseId || null,
      }));
      list.sort((a, b) => a.displayName.localeCompare(b.displayName, 'he'));
      setUsers(list);
      setLoadingUsers(false);
    });
    return () => unsub();
  }, []);

  // Add new house
  const handleAddHouse = async () => {
    const name = newHouseName.trim();
    if (!name) {
      toast.error('יש להזין שם בית מכירות');
      return;
    }
    setSavingHouse(true);
    try {
      const housesRef = ref(db, 'houses');
      const newRef = push(housesRef);
      await set(newRef, {
        name,
        createdAt: serverTimestamp(),
      });
      setNewHouseName('');
      toast.success('בית המכירות נוסף בהצלחה');
    } catch (err: any) {
      toast.error(err.message || 'שגיאה בהוספת בית מכירות');
    } finally {
      setSavingHouse(false);
    }
  };

  // Get effective value (pending change or current DB value)
  const getEffectiveRole = (user: UserEntry): UserRole =>
    pendingChanges[user.id]?.role ?? user.role;

  const getEffectiveHouseId = (user: UserEntry): string | null =>
    pendingChanges[user.id]?.houseId !== undefined
      ? pendingChanges[user.id]!.houseId!
      : user.houseId;

  // Handle role change locally
  const handleRoleChange = (userId: string, newRole: UserRole) => {
    setPendingChanges((prev) => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        role: newRole,
        // Clear houseId if not house_manager
        ...(newRole !== 'house_manager' ? { houseId: null } : {}),
      },
    }));
  };

  // Handle houseId change locally
  const handleHouseIdChange = (userId: string, houseId: string) => {
    setPendingChanges((prev) => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        houseId: houseId || null,
      },
    }));
  };

  // Check if user has unsaved changes
  const hasChanges = (user: UserEntry): boolean => {
    const changes = pendingChanges[user.id];
    if (!changes) return false;
    const roleChanged = changes.role !== undefined && changes.role !== user.role;
    const houseChanged = changes.houseId !== undefined && changes.houseId !== user.houseId;
    return roleChanged || houseChanged;
  };

  // Save user changes to Firebase
  const handleSaveUser = async (user: UserEntry) => {
    const changes = pendingChanges[user.id];
    if (!changes) return;

    const effectiveRole = changes.role ?? user.role;
    const effectiveHouseId =
      changes.houseId !== undefined ? changes.houseId : user.houseId;

    if (effectiveRole === 'house_manager' && !effectiveHouseId) {
      toast.error('יש לבחור בית מכירות עבור מנהל בית מכירות');
      return;
    }

    setSavingUserId(user.id);
    try {
      const updates: Record<string, any> = {};
      if (changes.role !== undefined) updates.role = effectiveRole;
      if (effectiveRole !== 'house_manager') {
        updates.houseId = null;
      } else if (changes.houseId !== undefined) {
        updates.houseId = effectiveHouseId;
      }

      await update(ref(db, `users/${user.id}`), updates);
      setPendingChanges((prev) => {
        const next = { ...prev };
        delete next[user.id];
        return next;
      });
      toast.success('המשתמש עודכן בהצלחה');
    } catch (err: any) {
      toast.error(err.message || 'שגיאה בעדכון משתמש');
    } finally {
      setSavingUserId(null);
    }
  };

  const roleLabel: Record<UserRole, string> = {
    participant: 'משתתף',
    house_manager: 'מנהל בית מכירות',
    admin: 'מנהל מערכת',
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">ניהול בתי מכירות ומשתמשים</h1>

        {/* ───── Section 1: Manage Auction Houses ───── */}
        <section className="mb-12">
          <h2 className="text-xl font-bold mb-4">בתי מכירות</h2>

          {/* Add house form */}
          <div className="glass rounded-xl p-6 mb-6">
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="block text-sm text-text-secondary mb-1">שם בית מכירות</label>
                <input
                  type="text"
                  value={newHouseName}
                  onChange={(e) => setNewHouseName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddHouse()}
                  placeholder="הזן שם בית מכירות..."
                  className="w-full bg-bg-elevated border border-border rounded-lg px-4 py-2.5 text-white placeholder:text-text-secondary focus:outline-none focus:border-accent/50"
                />
              </div>
              <button
                onClick={handleAddHouse}
                disabled={savingHouse}
                className="btn-accent px-5 py-2.5 rounded-lg font-semibold whitespace-nowrap disabled:opacity-50"
              >
                {savingHouse ? 'מוסיף...' : '+ הוסף בית מכירות'}
              </button>
            </div>
          </div>

          {/* Houses grid */}
          {loadingHouses ? (
            <div className="text-center text-text-secondary py-8">טוען בתי מכירות...</div>
          ) : houses.length === 0 ? (
            <div className="glass rounded-xl p-6 text-center text-text-secondary">
              אין בתי מכירות עדיין. הוסף את הראשון למעלה.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {houses.map((house) => (
                <div key={house.id} className="glass rounded-xl p-6">
                  <div className="font-bold text-lg mb-1">{house.name}</div>
                  <div className="text-sm text-text-secondary">
                    {house.createdAt
                      ? new Date(house.createdAt).toLocaleDateString('he-IL')
                      : 'תאריך לא זמין'}
                  </div>
                  <div className="text-xs text-text-secondary mt-2 font-mono opacity-50 truncate">
                    {house.id}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ───── Section 2: Manage Users ───── */}
        <section>
          <h2 className="text-xl font-bold mb-4">משתמשים</h2>

          {loadingUsers ? (
            <div className="text-center text-text-secondary py-8">טוען משתמשים...</div>
          ) : users.length === 0 ? (
            <div className="glass rounded-xl p-6 text-center text-text-secondary">
              אין משתמשים רשומים.
            </div>
          ) : (
            <div className="space-y-3">
              {users.map((user) => {
                const effectiveRole = getEffectiveRole(user);
                const effectiveHouseId = getEffectiveHouseId(user);
                const changed = hasChanges(user);
                const isSaving = savingUserId === user.id;

                return (
                  <div key={user.id} className="glass rounded-xl p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      {/* User info */}
                      <div className="flex-1 min-w-0">
                        <div className="font-bold truncate">{user.displayName || 'ללא שם'}</div>
                        <div className="text-sm text-text-secondary truncate">{user.email}</div>
                      </div>

                      {/* Role selector */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                        <div>
                          <label className="block text-xs text-text-secondary mb-1">תפקיד</label>
                          <select
                            value={effectiveRole}
                            onChange={(e) => handleRoleChange(user.id, e.target.value as UserRole)}
                            className="bg-bg-elevated border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent/50"
                          >
                            <option value="participant">{roleLabel.participant}</option>
                            <option value="house_manager">{roleLabel.house_manager}</option>
                            <option value="admin">{roleLabel.admin}</option>
                          </select>
                        </div>

                        {/* House selector (only for house_manager) */}
                        {effectiveRole === 'house_manager' && (
                          <div>
                            <label className="block text-xs text-text-secondary mb-1">בית מכירות</label>
                            <select
                              value={effectiveHouseId || ''}
                              onChange={(e) => handleHouseIdChange(user.id, e.target.value)}
                              className="bg-bg-elevated border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent/50"
                            >
                              <option value="">בחר בית מכירות...</option>
                              {houses.map((h) => (
                                <option key={h.id} value={h.id}>
                                  {h.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Save button */}
                        <div className="self-end">
                          <button
                            onClick={() => handleSaveUser(user)}
                            disabled={!changed || isSaving}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-smooth ${
                              changed
                                ? 'btn-accent'
                                : 'btn-dark opacity-50 cursor-not-allowed'
                            }`}
                          >
                            {isSaving ? 'שומר...' : 'שמור'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
