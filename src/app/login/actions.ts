'use server';

import { redirect } from 'next/navigation';

import { loginPathWithError } from '@/shared/feedbackMessages';
import { createSupabaseAdminClient } from '@/shared/supabase/admin';
import { createSupabaseServerClient } from '@/shared/supabase/server';

const AUTH_USERS_PAGE_SIZE = 200;
const AUTH_USERS_MAX_PAGES = 50;

async function findAuthUserIdByEmail(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  email: string,
): Promise<string | null> {
  const target = email.trim().toLowerCase();
  if (!target) return null;

  // Fast path: query auth.users directly when schema access is available.
  const { data: authUser, error: authUserError } = await admin
    .schema('auth')
    .from('users')
    .select('id')
    .ilike('email', target)
    .limit(1)
    .maybeSingle();

  if (!authUserError && authUser?.id) return authUser.id;

  // Fallback: paginate Auth Admin users and stop as soon as we find a match.
  for (let page = 1; page <= AUTH_USERS_MAX_PAGES; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: AUTH_USERS_PAGE_SIZE,
    });

    if (error) return null;

    const users = data.users ?? [];
    const found = users.find((u) => (u.email ?? '').toLowerCase() === target);
    if (found?.id) return found.id;

    if (users.length < AUTH_USERS_PAGE_SIZE) break;
    if (typeof data.lastPage === 'number' && page >= data.lastPage) break;
  }

  return null;
}

async function isDisabledByEmail(email: string): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  const authUserId = await findAuthUserIdByEmail(admin, email);
  if (!authUserId) return false;

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('is_active')
    .eq('id', authUserId)
    .maybeSingle();

  if (profileError || !profile) return false;
  return profile.is_active === false;
}

export async function login(formData: FormData) {
  const e2eDelayMs = Number(process.env.E2E_LOGIN_DELAY_MS ?? '0');
  if (Number.isFinite(e2eDelayMs) && e2eDelayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, e2eDelayMs));
  }

  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    redirect(loginPathWithError('missing'));
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  // If sign-in fails, we still try to detect disabled profile to show the right message.
  if (error || !data.user) {
    const disabled = await isDisabledByEmail(email);
    if (disabled) redirect(loginPathWithError('disabled'));
    redirect(loginPathWithError('bad'));
  }

  // Post-login check uses admin client to bypass RLS.
  const admin = createSupabaseAdminClient();
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('is_active')
    .eq('id', data.user.id)
    .single();

  if (profileError || !profile) {
    await supabase.auth.signOut();
    redirect(loginPathWithError('bad'));
  }

  if (profile.is_active === false) {
    await supabase.auth.signOut();
    redirect(loginPathWithError('disabled'));
  }

  redirect('/app');
}
