import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Middleware is pass-through. Admin protection is enforced by:
// 1. Firebase RTDB security rules (role-based write access on all critical paths)
// 2. Cloud Functions auth + role checks (all auction state mutations)
// 3. Client-side auth guards in admin pages (useEffect role check + redirect)
//
// Server-side route protection would require Firebase Admin SDK session cookies,
// which is not implemented in this version. All data operations are server-protected
// regardless of whether admin HTML is accessible.
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [],
};
