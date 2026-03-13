import type { AppRole } from '@/modules/auth_users';
import { createSupabaseAdminClient } from '@/shared/supabase/admin';

import { buildEmployeeProfilePayload } from './employeeMutationRules';

type Input = {
  email: string;
  fullName: string;
  password: string;
  restaurantId: string;
  role: Exclude<AppRole, 'admin'>;
  zoneId?: string | null;
  isAreaLead?: boolean;
};

export async function createEmployee(input: Input) {
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
  });

  if (error || !data.user) {
    throw new Error(`Failed to create user: ${error?.message ?? 'unknown error'}`);
  }

  const userId = data.user.id;

  // El trigger ya crea profiles(id). Aqui completamos los campos restantes.
  const { error: profileError } = await admin
    .from('profiles')
    .update(
      buildEmployeeProfilePayload({
        fullName: input.fullName,
        isAreaLead: input.isAreaLead ?? false,
        mustChangePassword: true,
        restaurantId: input.restaurantId,
        role: input.role as 'employee' | 'manager' | 'sub_manager',
        zoneId: input.zoneId,
      }),
    )
    .eq('id', userId);

  if (profileError) {
    const msg = profileError.message ?? '';

    if (
      profileError.code === '23505' &&
      msg.includes('ux_profiles_one_sub_manager_per_restaurant')
    ) {
      throw new Error('sub_manager_exists');
    }

    if (
      profileError.code === '23505' &&
      msg.includes('ux_profiles_one_manager_per_restaurant')
    ) {
      throw new Error('manager_exists');
    }

    throw new Error(`Failed to update profile: ${msg}`);
  }

  return userId;
}
