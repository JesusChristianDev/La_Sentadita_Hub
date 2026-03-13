import { createSupabaseAdminClient } from '@/shared/supabase/admin';

async function syncIsAreaLead(userId: string): Promise<void> {
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .from('area_leads')
    .select('id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .is('revoked_at', null)
    .limit(1);

  if (error) throw new Error(`Failed to sync is_area_lead: ${error.message}`);

  const isAreaLead = (data ?? []).length > 0;

  const { error: upd } = await admin
    .from('profiles')
    .update({ is_area_lead: isAreaLead })
    .eq('id', userId);
  if (upd) throw new Error(`Failed to update is_area_lead: ${upd.message}`);
}

export async function revokeAreaLead(leadId: string): Promise<void> {
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .from('area_leads')
    .select('user_id')
    .eq('id', leadId)
    .single();

  if (error || !data)
    throw new Error(`Failed to load lead: ${error?.message ?? 'not found'}`);

  const userId = data.user_id as string;

  const { error: updErr } = await admin
    .from('area_leads')
    .update({ is_active: false, revoked_at: new Date().toISOString() })
    .eq('id', leadId);

  if (updErr) throw new Error(`Failed to revoke lead: ${updErr.message}`);

  await syncIsAreaLead(userId);
}
