import { redirect } from 'next/navigation';

import { createSupabaseServerClient } from '@/shared/supabase/server';

import type { Profile } from '../domain/profile';

export type UserContext = {
  userId: string;
  profile: Profile;
};

export async function getCurrentUserContext(): Promise<UserContext | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) return null;

  const { data: profile, error } = await supabase
    .from('profiles')
    .select(
      'id, role, restaurant_id, employee_code, full_name, avatar_path, must_change_password, is_active',
    )
    .eq('id', data.user.id)
    .single();

  if (error) {
    throw new Error(`Failed to load profile: ${error.message}`);
  }

  const typed = profile as Profile;

  // Usuario desactivado => lo echamos mediante Route Handler (cookie-safe)
  if (typed.is_active === false) {
    redirect('/api/auth/signout?next=/login?e=disabled');
  }

  return { userId: data.user.id, profile: typed };
}
