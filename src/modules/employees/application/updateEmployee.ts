import { createSupabaseAdminClient } from '@/shared/supabase/admin';

export type UpdateEmployeeInput = {
  userId: string;
  fullName: string;
  restaurantId: string;
  role: 'employee' | 'manager' | 'sub_manager';
  email?: string;
  password?: string;
};

export async function updateEmployee(input: UpdateEmployeeInput) {
  const admin = createSupabaseAdminClient();

  // 1) Perfil (public.profiles)
  const { error: profileError } = await admin
    .from('profiles')
    .update({
      full_name: input.fullName,
      restaurant_id: input.restaurantId,
      role: input.role,
    })
    .eq('id', input.userId);

  if (profileError) {
    throw new Error(`Failed to update profile: ${profileError.message}`);
  }

  // 2) Auth (email/password) — admin API
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
