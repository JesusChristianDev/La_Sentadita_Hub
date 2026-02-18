import { cookies, headers } from 'next/headers';
import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@/shared/supabase/server';

export async function GET() {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const allCookies = cookieStore.getAll();

  const sbCookieNames = allCookies
    .map((cookie) => cookie.name)
    .filter((name) => name.startsWith('sb-'));

  const supabase = await createSupabaseServerClient();
  const [{ data: userData, error: userError }, { data: sessionData, error: sessionError }] =
    await Promise.all([supabase.auth.getUser(), supabase.auth.getSession()]);

  return NextResponse.json({
    host: headerStore.get('host'),
    forwardedHost: headerStore.get('x-forwarded-host'),
    sbCookieCount: sbCookieNames.length,
    sbCookieNames,
    hasActiveRestaurantCookie: Boolean(cookieStore.get('active_restaurant_id')?.value),
    getUser: {
      userId: userData.user?.id ?? null,
      error: userError?.message ?? null,
    },
    getSession: {
      userId: sessionData.session?.user?.id ?? null,
      expiresAt: sessionData.session?.expires_at ?? null,
      error: sessionError?.message ?? null,
    },
  });
}
