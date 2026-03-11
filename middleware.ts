import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Admin protection is handled by:
// 1. Firebase RTDB security rules (role-based write access)
// 2. Client-side auth guards in admin pages (useEffect role check)
// 3. Cloud Function auth checks (advanceRoundOrItem, processBid)
// Middleware cannot verify Firebase Auth tokens without the admin SDK,
// and the __session cookie is never set by the client auth flow.
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [],
};
