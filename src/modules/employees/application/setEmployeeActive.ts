import { createSupabaseAdminClient } from '@/shared/supabase/admin';

const BAN_100_YEARS = '876600h';

export async function setEmployeeActive(userId: string, isActive: boolean) {
  const admin = createSupabaseAdminClient();

  const payload = isActive
    ? { is_active: true, deleted_at: null }
    : { is_active: false, deleted_at: new Date().toISOString() };

  const { error: profileError } = await admin
    .from('profiles')
    .update(payload)
    .eq('id', userId);

  if (profileError) {
    throw new Error(`Failed to set employee active: ${profileError.message}`);
  }

  const ban_duration = isActive ? 'none' : BAN_100_YEARS;

  const { error: authError } = await admin.auth.admin.updateUserById(userId, {
    ban_duration,
  });

  if (authError) {
    throw new Error(`Failed to update auth ban: ${authError.message}`);
  }
}
