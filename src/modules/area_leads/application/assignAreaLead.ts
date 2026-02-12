import { createSupabaseAdminClient } from '@/shared/supabase/admin';

import type { ZoneKey } from '../domain/zone';

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

export async function assignAreaLead(params: {
  restaurantId: string;
  zone: ZoneKey;
  slot: 1 | 2;
  userId: string;
  assignedBy: string;
}): Promise<void> {
  const admin = createSupabaseAdminClient();

  // Si el slot está ocupado, lo revocamos (reemplazo)
  const { data: existing, error: exErr } = await admin
    .from('area_leads')
    .select('id, user_id')
    .eq('restaurant_id', params.restaurantId)
    .eq('zone', params.zone)
    .eq('lead_slot', params.slot)
    .eq('is_active', true)
    .is('revoked_at', null)
    .maybeSingle();

  if (exErr) throw new Error(`Failed to check slot: ${exErr.message}`);

  let replacedUserId: string | null = null;

  if (existing?.id) {
    replacedUserId = (existing.user_id as string) ?? null;

    const { error: revokeErr } = await admin
      .from('area_leads')
      .update({ is_active: false, revoked_at: new Date().toISOString() })
      .eq('id', existing.id);

    if (revokeErr)
      throw new Error(`Failed to revoke existing lead: ${revokeErr.message}`);
  }

  const { error: insErr } = await admin.from('area_leads').insert({
    restaurant_id: params.restaurantId,
    zone: params.zone,
    lead_slot: params.slot,
    user_id: params.userId,
    is_active: true,
    assigned_by: params.assignedBy,
  });

  if (insErr) throw new Error(`Failed to assign area lead: ${insErr.message}`);

  await syncIsAreaLead(params.userId);
  if (replacedUserId && replacedUserId !== params.userId) {
    await syncIsAreaLead(replacedUserId);
  }
}
