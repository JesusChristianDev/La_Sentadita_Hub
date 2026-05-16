import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { updateSession } from '@/lib/supabase/proxy';

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const CSRF_EXEMPT_PREFIXES = ['/api/auth/callback'];

function isCsrfExempt(pathname: string): boolean {
  return CSRF_EXEMPT_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export async function proxy(request: NextRequest) {
  const { method, nextUrl } = request;

  // CSRF: rechazar mutations a /api/* con Origin que no coincida con Host
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

  return updateSession(request);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|icons|manifest\\.webmanifest|sw\\.js).*)'],
};
