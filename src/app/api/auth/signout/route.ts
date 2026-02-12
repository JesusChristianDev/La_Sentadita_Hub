import { NextResponse } from 'next/server';

import { REMEMBER_SESSION_COOKIE } from '@/shared/supabase/authCookiePolicy';
import { createSupabaseServerClient } from '@/shared/supabase/server';

function safeNext(next: string | null): string {
  if (!next) return '/login';
  if (!next.startsWith('/')) return '/login';
  return next;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get('next'));

  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  const response = NextResponse.redirect(new URL(next, url.origin));
  response.cookies.delete('active_restaurant_id');
  response.cookies.delete(REMEMBER_SESSION_COOKIE);
  return response;
}
