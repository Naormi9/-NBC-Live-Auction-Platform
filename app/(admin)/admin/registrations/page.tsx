'use client';

import { useState, useEffect, useMemo } from 'react';
import { ref, onValue } from 'firebase/database';
import { db, auth } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import { isAllowedAdmin } from '@/lib/admin-allowlist';
import Navbar from '@/components/ui/Navbar';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import toast from 'react-hot-toast';
import type { VerificationStatus } from '@/lib/types';

interface RegisteredUser {
  uid: string;
  displayName: string;
  email: string;
  phone: string;
  idNumber: string;
  verificationStatus: VerificationStatus;
  callbackRequested: boolean;
  signatureData: string | null;
  createdAt: number;
  termsAcceptedAt: number | null;
}

const STATUS_LABELS: Record<VerificationStatus, string> = {
  pending_verification: 'ממתין לאימות',
  pending_approval: 'ממתין לאישור',
  approved: 'מאושר',
  rejected: 'נדחה',
};

const STATUS_COLORS: Record<VerificationStatus, string> = {
  pending_verification: 'bg-yellow-500/20 text-yellow-400',
  pending_approval: 'bg-orange-500/20 text-orange-400',
  approved: 'bg-green-500/20 text-green-400',
  rejected: 'bg-red-500/20 text-red-400',
};

type FilterOption = VerificationStatus | 'all' | 'callback';

export default function AdminRegistrationsPage() {
  const { user, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<RegisteredUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterOption>('pending_approval');
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [updatingUid, setUpdatingUid] = useState<string | null>(null);

  // Admin check — wait for auth to finish before deciding
  const isAdmin = !authLoading && user && isAllowedAdmin(user.email);

  // Fetch all users in real-time from /users (NOT /registrations)
  useEffect(() => {
    if (!isAdmin) return;
    const usersRef = ref(db, 'users');
    const unsub = onValue(
      usersRef,
      (snap) => {
        if (!snap.exists()) {
          setUsers([]);
          setLoading(false);
          return;
        }
        const data = snap.val();
        const list: RegisteredUser[] = Object.entries(data)
          .map(([uid, val]: [string, any]) => ({
            uid,
            displayName: val.displayName || '',
            email: val.email || '',
            phone: val.phone || '',
            idNumber: val.idNumber || '',
            verificationStatus: val.verificationStatus || 'pending_verification',
            callbackRequested: val.callbackRequested || false,
            signatureData: val.signatureData || null,
            createdAt: val.createdAt || 0,
            termsAcceptedAt: val.termsAcceptedAt || null,
          }))
          // Exclude admin users from the list
          .filter((u) => u.verificationStatus !== undefined && !isAllowedAdmin(u.email));

        // Sort: pending_approval first, then pending_verification, then others
        const statusOrder: Record<string, number> = {
          pending_approval: 0,
          pending_verification: 1,
          rejected: 2,
          approved: 3,
        };
        list.sort((a, b) => {
          const orderDiff = (statusOrder[a.verificationStatus] ?? 9) - (statusOrder[b.verificationStatus] ?? 9);
          if (orderDiff !== 0) return orderDiff;
          return (b.createdAt || 0) - (a.createdAt || 0);
        });

        setUsers(list);
        setLoading(false);
      },
      (error) => {
        console.error('Failed to read /users:', error.message);
        toast.error('שגיאה בטעינת נרשמים – בדוק הרשאות RTDB');
        setUsers([]);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [isAdmin]);

  // Filter users
  const filteredUsers = useMemo(() => {
    if (filter === 'all') return users;
    if (filter === 'callback') return users.filter((u) => u.callbackRequested);
    return users.filter((u) => u.verificationStatus === filter);
  }, [users, filter]);

  // Counts per status
  const counts = useMemo(() => {
    const c = { all: users.length, callback: 0, pending_verification: 0, pending_approval: 0, approved: 0, rejected: 0 };
    users.forEach((u) => {
      c[u.verificationStatus]++;
      if (u.callbackRequested) c.callback++;
    });
    return c;
  }, [users]);

  // Update user verification status via secured API route
  const handleUpdateStatus = async (uid: string, newStatus: VerificationStatus) => {
    if (!auth.currentUser) {
      toast.error('לא מחובר');
      return;
    }
    setUpdatingUid(uid);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch('/api/admin/update-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ targetUid: uid, newStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'שגיאה בעדכון סטטוס');
      }
      toast.success(`סטטוס עודכן: ${STATUS_LABELS[newStatus]}`);
    } catch (err: any) {
      toast.error(err.message || 'שגיאה בעדכון סטטוס');
    } finally {
      setUpdatingUid(null);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-text-secondary">אין הרשאה</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">ניהול נרשמים</h1>
          <span className="text-text-secondary text-sm">{users.length} נרשמים</span>
        </div>

        {/* Filter tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          <FilterTab
            label="הכל"
            count={counts.all}
            active={filter === 'all'}
            onClick={() => setFilter('all')}
          />
          <FilterTab
            label="ממתין לאישור"
            count={counts.pending_approval}
            active={filter === 'pending_approval'}
            onClick={() => setFilter('pending_approval')}
            highlight={counts.pending_approval > 0}
          />
          <FilterTab
            label="ממתין לאימות"
            count={counts.pending_verification}
            active={filter === 'pending_verification'}
            onClick={() => setFilter('pending_verification')}
          />
          <FilterTab
            label="callback"
            count={counts.callback}
            active={filter === 'callback'}
            onClick={() => setFilter('callback')}
            highlight={counts.callback > 0}
          />
          <FilterTab
            label="מאושרים"
            count={counts.approved}
            active={filter === 'approved'}
            onClick={() => setFilter('approved')}
          />
          <FilterTab
            label="נדחו"
            count={counts.rejected}
            active={filter === 'rejected'}
            onClick={() => setFilter('rejected')}
          />
        </div>

        {/* Users list */}
        {loading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="glass rounded-xl p-8 text-center text-text-secondary">
            אין נרשמים בקטגוריה זו
          </div>
        ) : (
          <div className="space-y-3">
            {filteredUsers.map((u) => {
              const isExpanded = expandedUser === u.uid;
              const isUpdating = updatingUid === u.uid;

              return (
                <div key={u.uid} className="glass rounded-xl overflow-hidden">
                  {/* Summary row */}
                  <button
                    onClick={() => setExpandedUser(isExpanded ? null : u.uid)}
                    className="w-full p-4 flex items-center gap-4 text-right hover:bg-white/5 transition-smooth"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-bold truncate">{u.displayName || 'ללא שם'}</div>
                      <div className="text-sm text-text-secondary truncate">{u.email}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {u.callbackRequested && (
                        <span className="bg-blue-500/20 text-blue-400 text-xs px-2 py-1 rounded-full">
                          callback
                        </span>
                      )}
                      <span className={`text-xs px-3 py-1 rounded-full font-medium ${STATUS_COLORS[u.verificationStatus]}`}>
                        {STATUS_LABELS[u.verificationStatus]}
                      </span>
                      <span className="text-text-secondary text-sm">{isExpanded ? '▲' : '▼'}</span>
                    </div>
                  </button>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="border-t border-border p-4 space-y-4">
                      {/* Info grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <InfoField label="שם מלא" value={u.displayName} />
                        <InfoField label='ת"ז' value={u.idNumber || 'לא הוזן'} dir="ltr" />
                        <InfoField label="טלפון" value={u.phone || 'לא הוזן'} dir="ltr" />
                        <InfoField label="אימייל" value={u.email} dir="ltr" />
                        <InfoField
                          label="callback"
                          value={u.callbackRequested ? 'כן - ביקש חזרה טלפונית' : 'לא'}
                        />
                        <InfoField
                          label="נרשם בתאריך"
                          value={u.createdAt ? new Date(u.createdAt).toLocaleString('he-IL') : 'לא ידוע'}
                        />
                        <InfoField
                          label="אישר תקנון"
                          value={u.termsAcceptedAt ? new Date(u.termsAcceptedAt).toLocaleString('he-IL') : 'לא'}
                        />
                      </div>

                      {/* Signature preview */}
                      {u.signatureData && (
                        <div>
                          <label className="block text-xs text-text-secondary mb-2">חתימה דיגיטלית</label>
                          <div className="bg-bg-elevated rounded-lg p-2 inline-block border border-border">
                            <img
                              src={u.signatureData}
                              alt="חתימה"
                              className="max-h-20 w-auto"
                            />
                          </div>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                        {u.verificationStatus !== 'approved' && (
                          <ActionButton
                            label="אשר"
                            color="bg-green-600 hover:bg-green-700"
                            disabled={isUpdating}
                            loading={isUpdating}
                            onClick={() => handleUpdateStatus(u.uid, 'approved')}
                          />
                        )}
                        {u.verificationStatus !== 'rejected' && (
                          <ActionButton
                            label="דחה"
                            color="bg-red-600 hover:bg-red-700"
                            disabled={isUpdating}
                            loading={isUpdating}
                            onClick={() => handleUpdateStatus(u.uid, 'rejected')}
                          />
                        )}
                        {(u.verificationStatus === 'approved' || u.verificationStatus === 'rejected') && (
                          <ActionButton
                            label="החזר לממתין"
                            color="bg-yellow-600 hover:bg-yellow-700"
                            disabled={isUpdating}
                            loading={isUpdating}
                            onClick={() => handleUpdateStatus(u.uid, u.callbackRequested ? 'pending_approval' : 'pending_verification')}
                          />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function FilterTab({
  label,
  count,
  active,
  onClick,
  highlight = false,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  highlight?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-smooth ${
        active
          ? 'bg-accent text-white'
          : highlight
          ? 'bg-orange-500/20 text-orange-300 hover:bg-orange-500/30'
          : 'bg-bg-elevated text-text-secondary hover:text-white'
      }`}
    >
      {label} ({count})
    </button>
  );
}

function InfoField({ label, value, dir }: { label: string; value: string; dir?: string }) {
  return (
    <div>
      <label className="block text-xs text-text-secondary mb-1">{label}</label>
      <div className="text-sm font-medium" dir={dir}>
        {value}
      </div>
    </div>
  );
}

function ActionButton({
  label,
  color,
  disabled,
  loading,
  onClick,
}: {
  label: string;
  color: string;
  disabled: boolean;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 rounded-lg text-sm font-semibold text-white transition-smooth disabled:opacity-50 ${color}`}
    >
      {loading ? 'מעדכן...' : label}
    </button>
  );
}
