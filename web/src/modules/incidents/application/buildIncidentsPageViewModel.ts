import 'server-only';

import { buildFrontendSessionView, type CurrentSession } from '@/modules/auth_users';
import { can } from '@/modules/authz';
import { loadEmployeesPageProjection } from '@/shared/db/employment';
import { createSupabaseAdminClient } from '@/shared/supabase/admin';

import type { IncidentRecord } from '../domain/incidentTypes';
import { listVisibleIncidents } from './incidentService';

export type IncidentOwnerOption = {
  id: string;
  label: string;
  role: string;
};

type IncidentZone = {
  id: string;
  name: string;
};

export type IncidentsPageViewModel = {
  canCreate: boolean;
  canManage: boolean;
  currentRestaurantId: string | null;
  currentRestaurantName: string | null;
  incidents: IncidentRecord[];
  mode: 'context_required' | 'forbidden' | 'restaurant_workspace' | 'self_service' | 'zone_workspace';
  ownerOptions: IncidentOwnerOption[];
  zones: IncidentZone[];
};

async function listRestaurantZones(restaurantId: string): Promise<IncidentZone[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('restaurant_zones')
    .select('id, name')
    .eq('restaurant_id', restaurantId)
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) {
    throw new Error(`Failed to load restaurant zones: ${error.message}`);
  }

  return (data ?? []) as IncidentZone[];
}

export async function buildIncidentsPageViewModel(
  session: CurrentSession,
): Promise<IncidentsPageViewModel> {
  const frontendSession = buildFrontendSessionView(session);

  if (!can(session.requestContext, 'incidents.view')) {
    return {
      canCreate: false,
      canManage: false,
      currentRestaurantId: null,
      currentRestaurantName: null,
      incidents: [],
      mode: 'forbidden',
      ownerOptions: [],
      zones: [],
    };
  }

  const currentRestaurantId = frontendSession.effectiveRestaurantId;
  const currentRestaurantName =
    frontendSession.visibleRestaurants.find((restaurant) => restaurant.id === currentRestaurantId)
      ?.name ?? null;

  if (!currentRestaurantId) {
    return {
      canCreate: false,
      canManage: false,
      currentRestaurantId: null,
      currentRestaurantName: null,
      incidents: [],
      mode: 'context_required',
      ownerOptions: [],
      zones: [],
    };
  }

  const mode =
    session.requestContext.systemRole === 'area_lead'
      ? 'zone_workspace'
      : can(session.requestContext, 'incidents.manage')
        ? 'restaurant_workspace'
        : 'self_service';

  const canManage = mode === 'restaurant_workspace';

  const [incidents, zones, ownerOptions] = await Promise.all([
    listVisibleIncidents(currentRestaurantId),
    listRestaurantZones(currentRestaurantId),
    canManage
      ? loadEmployeesPageProjection(currentRestaurantId, 'active').then((projection) =>
          projection.employees.map((employee) => ({
            id: employee.id,
            label: employee.full_name,
            role: employee.system_role,
          })),
        )
      : Promise.resolve([] as IncidentOwnerOption[]),
  ]);

  return {
    canCreate: true,
    canManage,
    currentRestaurantId,
    currentRestaurantName,
    incidents,
    mode,
    ownerOptions,
    zones,
  };
}
