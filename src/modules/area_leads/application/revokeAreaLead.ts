import { createSupabaseAdminClient } from '@/shared/supabase/admin';

export async function revokeAreaLead(leadId: string): Promise<void> {
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .from('area_leads')
    .select('user_id')
    .eq('id', leadId)
    .single();

  if (error || !data)
    throw new Error(`Failed to load lead: ${error?.message ?? 'not found'}`);

  const { error: updErr } = await admin
    .from('area_leads')
    .update({ is_active: false, revoked_at: new Date().toISOString() })
    .eq('id', leadId);

  if (updErr) throw new Error(`Failed to revoke lead: ${updErr.message}`);
}