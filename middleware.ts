import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/admin')) {
    // Check for auth cookie (Firebase sets __session cookie)
    const session = request.cookies.get('__session');
    if (!session) {
      return NextResponse.redirect(new URL('/login?redirect=/admin', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
