import { createSupabaseAdminClient } from '@/shared/supabase/admin';

import type { ZoneKey } from '../domain/zone';

export type AreaLead = {
  id: string;
  zone: ZoneKey;
  lead_slot: 1 | 2;
  user_id: string;
  full_name: string | null;
};

export async function listActiveAreaLeads(restaurantId: string): Promise<AreaLead[]> {
  const admin = createSupabaseAdminClient();

  const { data: leads, error } = await admin
    .from('area_leads')
    .select('id, zone, lead_slot, user_id')
    .eq('restaurant_id', restaurantId)
    .eq('is_active', true)
    .is('revoked_at', null);

  if (error) throw new Error(`Failed to list area leads: ${error.message}`);

  const userIds = Array.from(new Set((leads ?? []).map((l) => l.user_id)));
  if (userIds.length === 0) return [];

  const { data: profiles, error: profilesError } = await admin
    .from('profiles')
    .select('id, full_name')
    .in('id', userIds);

  if (profilesError)
    throw new Error(`Failed to load lead profiles: ${profilesError.message}`);

  const byId = new Map((profiles ?? []).map((p) => [p.id, p.full_name as string | null]));

  return (leads ?? []).map((l) => ({
    id: l.id as string,
    zone: l.zone as ZoneKey,
    lead_slot: l.lead_slot as 1 | 2,
    user_id: l.user_id as string,
    full_name: byId.get(l.user_id as string) ?? null,
  }));
}
