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
  userId: string;
  assignedBy: string;
}): Promise<void> {
  const admin = createSupabaseAdminClient();

  const { data: activeInZone, error: zoneErr } = await admin
    .from('area_leads')
    .select('lead_slot')
    .eq('restaurant_id', params.restaurantId)
    .eq('zone', params.zone)
    .eq('is_active', true)
    .is('revoked_at', null);

  if (zoneErr) throw new Error(`Failed to check zone capacity: ${zoneErr.message}`);

  const usedSlots = new Set((activeInZone ?? []).map((row) => row.lead_slot as 1 | 2));
  const freeSlot = !usedSlots.has(1) ? 1 : !usedSlots.has(2) ? 2 : null;

  if (!freeSlot) {
    throw new Error('area_lead_zone_full');
  }

  const { error: insErr } = await admin.from('area_leads').insert({
    restaurant_id: params.restaurantId,
    zone: params.zone,
    lead_slot: freeSlot,
    user_id: params.userId,
    is_active: true,
    assigned_by: params.assignedBy,
  });

  if (insErr) throw new Error(`Failed to assign area lead: ${insErr.message}`);

  await syncIsAreaLead(params.userId);
}
