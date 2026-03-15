import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { ADMIN_EMAILS } from '@/lib/admin-allowlist';

const VALID_STATUSES = ['pending_verification', 'pending_approval', 'approved', 'rejected'];

/**
 * Server-side API route for updating user verification status.
 * Enforces: Firebase Auth token verification + admin email allowlist.
 * Only ceo@m-motors.co.il and office@m-motors.co.il can use this.
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Extract and verify Firebase ID token
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing authorization' }, { status: 401 });
    }

    const token = authHeader.slice(7).trim();
    const adminAuth = await getAdminAuth();
    let decoded;
    try {
      decoded = await adminAuth.verifyIdToken(token);
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // 2. Verify email is in admin allowlist
    const email = decoded.email?.toLowerCase().trim();
    if (!email || !ADMIN_EMAILS.includes(email)) {
      return NextResponse.json({ error: 'Unauthorized: email not in admin allowlist' }, { status: 403 });
    }

    // 3. Verify admin role in RTDB
    const adminDb = await getAdminDb();
    const roleSnap = await adminDb.ref(`users/${decoded.uid}/role`).once('value');
    const role = roleSnap.val();
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized: admin role required' }, { status: 403 });
    }

    // 4. Validate request body
    const { targetUid, newStatus } = await req.json();

    if (!targetUid || typeof targetUid !== 'string') {
      return NextResponse.json({ error: 'Missing targetUid' }, { status: 400 });
    }

    if (!newStatus || !VALID_STATUSES.includes(newStatus)) {
      return NextResponse.json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 });
    }

    // 5. Verify target user exists
    const targetSnap = await adminDb.ref(`users/${targetUid}`).once('value');
    if (!targetSnap.exists()) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 });
    }

    // 6. Prevent admin from changing their own verification status
    if (targetUid === decoded.uid) {
      return NextResponse.json({ error: 'Cannot change own verification status' }, { status: 400 });
    }

    // 7. Update verification status (Admin SDK bypasses RTDB rules)
    await adminDb.ref(`users/${targetUid}/verificationStatus`).set(newStatus);

    return NextResponse.json({
      success: true,
      targetUid,
      newStatus,
      updatedBy: email,
    });
  } catch (err: any) {
    console.error('update-verification error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
