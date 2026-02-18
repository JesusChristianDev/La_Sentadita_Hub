import { NextResponse } from 'next/server';

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
  return response;
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const formData = await request.formData();
  const next = safeNext(String(formData.get('next') ?? '/login'));

  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  const response = NextResponse.redirect(new URL(next, url.origin), 303);
  response.cookies.delete('active_restaurant_id');
  return response;
}
