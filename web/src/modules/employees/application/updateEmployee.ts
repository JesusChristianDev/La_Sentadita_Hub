import { createSupabaseAdminClient } from '@/shared/supabase/admin';

import { buildEmployeeProfilePayload } from './employeeMutationRules';

export type UpdateEmployeeInput = {
  userId: string;
  fullName: string;
  restaurantId: string;
  role: 'employee' | 'manager' | 'sub_manager';
  email?: string;
  password?: string;
  zoneId?: string | null;
  isAreaLead?: boolean;
};

export async function updateEmployee(input: UpdateEmployeeInput) {
  const admin = createSupabaseAdminClient();

  // 1) Perfil (public.profiles)
  const { error: profileError } = await admin
    .from('profiles')
    .update(
      buildEmployeeProfilePayload({
        fullName: input.fullName,
        isAreaLead: input.isAreaLead ?? false,
        restaurantId: input.restaurantId,
        role: input.role,
        zoneId: input.zoneId,
      }),
    )
    .eq('id', input.userId);

  if (profileError) {
    throw new Error(`Failed to update profile: ${profileError.message}`);
  }

  // 2) Auth (email/password) via admin API
  // updateUserById aplica cambios directo (server-only)
  if (input.email || input.password) {
    const attributes: { email?: string; password?: string } = {};
    if (input.email) attributes.email = input.email;
    if (input.password) attributes.password = input.password;

    const { error: authError } = await admin.auth.admin.updateUserById(
      input.userId,
      attributes,
    );

    if (authError) {
      throw new Error(`Failed to update auth user: ${authError.message}`);
    }
  }
}
