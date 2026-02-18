import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

import { env } from '@/shared/env';

const PUBLIC_PATH_PREFIXES = ['/login', '/api', '/_next', '/favicon.ico'];

function isPublicPath(pathname: string) {
  return PUBLIC_PATH_PREFIXES.some((prefix) => {
    if (prefix === '/favicon.ico') return pathname === prefix;
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  });
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // Manten request/response en sync para evitar sesiones inconsistentes
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));

        response = NextResponse.next({ request });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const isAuthed = Boolean(data.user);

  const pathname = request.nextUrl.pathname;
  const isPublic = isPublicPath(pathname);
  const isDocumentRequest =
    request.headers.get('sec-fetch-dest') === 'document' ||
    request.headers.get('accept')?.includes('text/html');

  if (!isAuthed && !isPublic && isDocumentRequest) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return response;
}
