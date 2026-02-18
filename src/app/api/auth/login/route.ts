import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

import { env } from '@/shared/env';
import { createSupabaseAdminClient } from '@/shared/supabase/admin';

function redirectWithError(request: NextRequest, code: string): NextResponse {
  return NextResponse.redirect(new URL(`/login?e=${code}`, request.url), 303);
}

async function isDisabledByEmail(email: string): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  const target = email.toLowerCase();
  const perPage = 1000;

  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`Failed to list users: ${error.message}`);

    const users = data.users ?? [];
    const found = users.find((u) => (u.email ?? '').toLowerCase() === target);
    if (!found?.id) {
      if (users.length < perPage) break;
      continue;
    }

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('is_active')
      .eq('id', found.id)
      .single();

    if (profileError || !profile) return false;
    return profile.is_active === false;
  }

  return false;
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return redirectWithError(request, 'missing');
  }

  let response = NextResponse.redirect(new URL('/app', request.url), 303);

  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, {
            ...options,
            path: '/',
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
          });
        });
      },
    },
  });

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    const disabled = await isDisabledByEmail(email);
    return redirectWithError(request, disabled ? 'disabled' : 'bad');
  }

  const admin = createSupabaseAdminClient();
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('is_active')
    .eq('id', data.user.id)
    .single();

  if (profileError || !profile) {
    await supabase.auth.signOut();
    response = redirectWithError(request, 'bad');
    return response;
  }

  if (profile.is_active === false) {
    await supabase.auth.signOut();
    response = redirectWithError(request, 'disabled');
    return response;
  }

  return response;
}
