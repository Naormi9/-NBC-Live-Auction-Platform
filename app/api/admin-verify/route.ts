import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_EMAILS } from '@/lib/admin-allowlist';

/**
 * Server-side admin email verification endpoint.
 * Checks if the provided email is in the admin allowlist.
 * This provides an additional layer of security beyond client-side checks.
 */
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Missing email' }, { status: 400 });
    }

    const isAdmin = ADMIN_EMAILS.includes(email.toLowerCase().trim());

    return NextResponse.json({ isAdmin });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
