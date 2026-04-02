import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import {
  ACTIVE_RESTAURANT_ID_COOKIE,
  ACTIVE_SCOPE_ID_COOKIE,
  ACTIVE_SCOPE_TYPE_COOKIE,
} from '@/modules/auth_users/application/activeScopeCookies';
import { env } from '@/shared/env';

function safeNext(next: string | null): string {
  if (!next) return '/login';
  if (!next.startsWith('/')) return '/login';
  if (next.startsWith('//')) return '/login';
  return next;
}

async function createSupabaseRouteClient(response: NextResponse) {
  const cookieStore = await cookies();

  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });
}

function clearResponseScopeCookies(response: NextResponse) {
  response.cookies.delete(ACTIVE_SCOPE_TYPE_COOKIE);
  response.cookies.delete(ACTIVE_SCOPE_ID_COOKIE);
  response.cookies.delete(ACTIVE_RESTAURANT_ID_COOKIE);
}

async function signOutAndRedirect(request: Request, next: string, status?: 303) {
  const url = new URL(request.url);
  const response = status
    ? NextResponse.redirect(new URL(next, url.origin), status)
    : NextResponse.redirect(new URL(next, url.origin));

  const supabase = await createSupabaseRouteClient(response);
  await supabase.auth.signOut({ scope: 'local' });
  clearResponseScopeCookies(response);

  return response;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get('next'));

  return signOutAndRedirect(request, next);
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const next = safeNext(String(formData.get('next') ?? '/login'));

  return signOutAndRedirect(request, next, 303);
}
