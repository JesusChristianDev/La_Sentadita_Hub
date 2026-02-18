import { cookies, headers } from 'next/headers';
import { NextResponse } from 'next/server';

import { createSupabaseAdminClient } from '@/shared/supabase/admin';
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

  const userId = userData.user?.id ?? sessionData.session?.user?.id ?? null;
  let profile: { id: string; role: string; is_active: boolean | null } | null = null;
  let profileError: string | null = null;

  if (userId) {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from('profiles')
      .select('id, role, is_active')
      .eq('id', userId)
      .maybeSingle();

    if (error) profileError = error.message;
    if (data) {
      profile = {
        id: data.id as string,
        role: data.role as string,
        is_active: (data.is_active as boolean | null) ?? null,
      };
    }
  }

  return NextResponse.json({
    vercelCommitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    vercelBranch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
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
    profile,
    profileError,
  });
}
