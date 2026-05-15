import { type NextRequest, NextResponse } from 'next/server';

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Supabase auth callback uses GET; exclude non-mutation paths from check.
const CSRF_EXEMPT_PREFIXES = ['/api/auth/callback'];

function isCsrfExempt(pathname: string): boolean {
  return CSRF_EXEMPT_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function middleware(request: NextRequest): NextResponse {
  const { method, nextUrl } = request;

  if (
    MUTATION_METHODS.has(method) &&
    nextUrl.pathname.startsWith('/api/') &&
    !isCsrfExempt(nextUrl.pathname)
  ) {
    const origin = request.headers.get('origin');
    if (origin !== null) {
      const host = request.headers.get('host');
      let originHost: string | null = null;
      try {
        originHost = new URL(origin).host;
      } catch {
        return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
      }
      if (originHost !== host) {
        return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
