import { createSupabaseAdminClient } from '@/shared/supabase/admin';

export async function deleteEmployee(userId: string, opts?: { soft?: boolean }) {
  const admin = createSupabaseAdminClient();

  const soft = opts?.soft ?? true;

  // 1) Soft-delete en Auth (no reversible) o hard-delete
  const { error } = await admin.auth.admin.deleteUser(userId, soft);

  if (error) {
    throw new Error(`Failed to delete auth user: ${error.message}`);
  }

  // 2) Opcional: marcar perfil como inactivo (para que no aparezca en listados)
  await admin
    .from('profiles')
    .update({ is_active: false, deleted_at: new Date().toISOString() })
    .eq('id', userId);
}
