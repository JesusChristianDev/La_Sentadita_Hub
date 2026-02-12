'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { loginPathWithError } from '@/shared/feedbackMessages';
import { createSupabaseAdminClient } from '@/shared/supabase/admin';
import { REMEMBER_SESSION_COOKIE } from '@/shared/supabase/authCookiePolicy';
import { createSupabaseServerClient } from '@/shared/supabase/server';

async function isDisabledByEmail(email: string): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  const target = email.toLowerCase();

  // MVP: listUsers es paginado. Buscamos unas cuantas paginas.
  // (Con pocos usuarios, esto va rapido.)
  const perPage = 1000;

  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(`Failed to list users: ${error.message}`);
    }

    const users = data.users ?? [];
    const found = users.find((u) => (u.email ?? '').toLowerCase() === target);

    if (found?.id) {
      const { data: profile, error: profileError } = await admin
        .from('profiles')
        .select('is_active')
        .eq('id', found.id)
        .single();

      if (profileError || !profile) return false;
      return profile.is_active === false;
    }

    // Si esta pagina vino incompleta, ya no hay mas usuarios.
    if (users.length < perPage) break;
  }

  return false;
}

export async function login(formData: FormData) {
  const e2eDelayMs = Number(process.env.E2E_LOGIN_DELAY_MS ?? '0');
  if (Number.isFinite(e2eDelayMs) && e2eDelayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, e2eDelayMs));
  }

  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const remember = String(formData.get('remember') ?? '') === 'on';

  if (!email || !password) {
    redirect(loginPathWithError('missing'));
  }

  const supabase = await createSupabaseServerClient({ persistSession: remember });
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  // Si falla login, puede ser password mal o usuario baneado.
  // Si esta desactivado en profiles => mensaje correcto.
  if (error || !data.user) {
    const disabled = await isDisabledByEmail(email);
    if (disabled) redirect(loginPathWithError('disabled'));
    redirect(loginPathWithError('bad'));
  }

  // Si loguea, validamos estado con admin (sin RLS)
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

  const cookieStore = await cookies();
  cookieStore.set(REMEMBER_SESSION_COOKIE, remember ? '1' : '0', {
    path: '/',
    sameSite: 'lax',
    ...(remember ? { maxAge: 60 * 60 * 24 * 30 } : {}),
  });

  redirect('/app');
}
