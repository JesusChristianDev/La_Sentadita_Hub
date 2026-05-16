import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import {
  type EmploymentListItem,
  type EmploymentStatusFilter,
} from '@/modules/employment/domain/employmentTypes';
import { coerceSystemRole } from '@/shared/authz';
import {
  type EmployeesPageProjection,
  type PersonRow,
  type ZoneAssignmentRow,
  type RestaurantAssignmentRow,
  type RoleScopeRow,
  type RestaurantZoneSummary,
  todayIsoDate,
  isCurrentTemporalRow,
  pickCurrentOrLatest,
  formatFullName,
  mapSystemRoleToEmployment,
  loadPeopleByIds,
  loadEmploymentsByIds,
  loadRestaurantAssignmentsByEmploymentIds,
  loadZoneAssignmentsByEmploymentIds,
  loadCurrentRoleScopesForPerson,
  loadCurrentRestaurantAssignment,
  loadCurrentZoneAssignment,
  loadRestaurantZonesByRestaurantId,
  loadCurrentEmploymentForPerson,
} from './employmentRepository';

export async function loadEmployeesPageProjection(
  restaurantId: string,
  status: EmploymentStatusFilter = 'active',
): Promise<EmployeesPageProjection> {
  const [employees, restaurantZones] = await Promise.all([
    listEmploymentForRestaurantProjection(restaurantId, status),
    loadRestaurantZonesByRestaurantId(restaurantId),
  ]);

  return {
    employees,
    restaurantZones,
  };
}

async function loadRestaurantIdsForEmploymentScope(params: {
  scopeId: string;
  scopeType: 'organization' | 'chain' | 'company' | 'restaurant';
}): Promise<string[]> {
  const admin = createSupabaseAdminClient();

  if (params.scopeType === 'restaurant') {
    return [params.scopeId];
  }

  if (params.scopeType === 'company') {
    const { data, error } = await admin
      .from('restaurants')
      .select('id')
      .eq('company_id', params.scopeId);

    if (error) throw new Error(`Failed to load restaurant ids: ${error.message}`);
    return (data ?? []).map((row: { id: string }) => row.id);
  }

  // organization / chain => resolve company_ids first, then restaurants.
  const companiesQuery =
    params.scopeType === 'organization'
      ? admin.from('companies').select('company_id').eq('organization_id', params.scopeId)
      : admin.from('companies').select('company_id').eq('chain_id', params.scopeId);

  const { data: companiesData, error: companiesError } = await companiesQuery;
  if (companiesError) throw new Error(`Failed to load company ids: ${companiesError.message}`);

  const companyIds = Array.from(
    new Set((companiesData ?? []).map((row: { company_id: string }) => row.company_id)),
  );
  if (companyIds.length === 0) return [];

  const { data: restaurantsData, error: restaurantsError } = await admin
    .from('restaurants')
    .select('id')
    .in('company_id', companyIds);

  if (restaurantsError) {
    throw new Error(`Failed to load restaurant ids: ${restaurantsError.message}`);
  }

  return (restaurantsData ?? []).map((row: { id: string }) => row.id);
}

async function listEmploymentForGenericScopeProjection(params: {
  scopeId: string;
  scopeType: 'organization' | 'chain' | 'company' | 'restaurant';
  status: EmploymentStatusFilter;
}): Promise<EmploymentListItem[]> {
  const today = todayIsoDate();
  const admin = createSupabaseAdminClient();

  const restaurantIds = await loadRestaurantIdsForEmploymentScope({
    scopeId: params.scopeId,
    scopeType: params.scopeType,
  });

  if (restaurantIds.length === 0) return [];

  const { data, error } = await admin
    .from('employment_restaurant_assignments')
    .select('assignment_id, employment_id, restaurant_id, valid_from, valid_to, created_at')
    .in('restaurant_id', restaurantIds)
    .order('valid_from', { ascending: false });

  if (error) {
    throw new Error(`Failed to list scope assignments: ${error.message}`);
  }

  const restaurantAssignments = (data ?? []) as RestaurantAssignmentRow[];

  const employmentIds = Array.from(new Set(restaurantAssignments.map((row) => row.employment_id)));
  const employmentsById = await loadEmploymentsByIds(employmentIds);

  const relevantAssignments = restaurantAssignments.filter((assignment) =>
    employmentsById.has(assignment.employment_id),
  );

  const personIds = Array.from(
    new Set(
      relevantAssignments
        .map((assignment) => employmentsById.get(assignment.employment_id)?.person_id ?? null)
        .filter((personId): personId is string => Boolean(personId)),
    ),
  );

  const peopleById = await loadPeopleByIds(personIds);
  const zoneAssignmentsByEmploymentId = await loadZoneAssignmentsByEmploymentIds(
    Array.from(new Set(relevantAssignments.map((row) => row.employment_id))),
  );

  const itemsByPersonId = new Map<string, EmploymentListItem>();

  for (const assignment of relevantAssignments) {
    const employment = employmentsById.get(assignment.employment_id);
    if (!employment) continue;

    const person = peopleById.get(employment.person_id);
    if (!person) continue;

    const systemRole = coerceSystemRole(person.system_role);
    // El módulo "Equipo" está pensado para roles operativos.
    // Pero para visibilidad de archivados (ej: YANI), incluimos roles no-operativos
    // cuando la persona está archivada (soporta listado por `inactive/all`).
    const isOperationalRole =
      systemRole === 'employee' || systemRole === 'manager' || systemRole === 'area_lead';
    if (!isOperationalRole && person.is_archived === false) continue;

    const zoneAssignment = pickCurrentOrLatest(
      zoneAssignmentsByEmploymentId.get(employment.employment_id) ?? [],
      today,
    );

    const isActive =
      person.access_status === 'active' &&
      person.is_archived === false &&
      isCurrentTemporalRow(employment, today) &&
      isCurrentTemporalRow(assignment, today);

    const nextItem: EmploymentListItem = {
      avatar_path: person.avatar_url,
      employee_code: Number.parseInt(person.agora_employee_id ?? '0', 10) || 0,
      full_name: formatFullName(person) || '(sin nombre)',
      id: person.person_id,
      is_active: isActive,
      restaurant_id: assignment.restaurant_id,
      system_role: mapSystemRoleToEmployment(systemRole),
      zone_id: zoneAssignment?.zone_id ?? null,
    };

    const existing = itemsByPersonId.get(person.person_id);
    // If multiple assignments, keep the active one or the latest one
    if (!existing || (!existing.is_active && isActive)) {
      itemsByPersonId.set(person.person_id, nextItem);
    }
  }

  const items = Array.from(itemsByPersonId.values()).sort(
    (left, right) => left.employee_code - right.employee_code,
  );

  if (params.status === 'active') return items.filter((item) => item.is_active);
  if (params.status === 'inactive') return items.filter((item) => !item.is_active);
  return items;
}

export async function listEmploymentForRestaurantProjection(
  restaurantId: string,
  status: EmploymentStatusFilter = 'active',
): Promise<EmploymentListItem[]> {
  return listEmploymentForGenericScopeProjection({
    scopeId: restaurantId,
    scopeType: 'restaurant',
    status,
  });
}

export async function listEmploymentForOrganizationProjection(
  organizationId: string,
  status: EmploymentStatusFilter = 'active',
): Promise<EmploymentListItem[]> {
  return listEmploymentForGenericScopeProjection({
    scopeId: organizationId,
    scopeType: 'organization',
    status,
  });
}

export async function listEmploymentForChainProjection(
  chainId: string,
  status: EmploymentStatusFilter = 'active',
): Promise<EmploymentListItem[]> {
  return listEmploymentForGenericScopeProjection({
    scopeId: chainId,
    scopeType: 'chain',
    status,
  });
}

export async function listEmploymentForCompanyProjection(
  companyId: string,
  status: EmploymentStatusFilter = 'active',
): Promise<EmploymentListItem[]> {
  return listEmploymentForGenericScopeProjection({
    scopeId: companyId,
    scopeType: 'company',
    status,
  });
}

async function loadAreaLeadConflictPersonIds(params: {
  excludingUserId?: string;
  today: string;
  zoneId: string;
}): Promise<string[]> {
  const admin = createSupabaseAdminClient();
  const { data: zoneAssignments, error: zoneError } = await admin
    .from('employment_zone_assignments')
    .select('employment_id, zone_id, valid_from, valid_to, created_at, assignment_id')
    .eq('zone_id', params.zoneId);

  if (zoneError) {
    throw new Error(`Failed to load zone assignments: ${zoneError.message}`);
  }

  const activeZoneAssignments = ((zoneAssignments ?? []) as ZoneAssignmentRow[]).filter((row) =>
    isCurrentTemporalRow(row, params.today),
  );

  if (activeZoneAssignments.length === 0) return [];

  const employmentsById = await loadEmploymentsByIds(
    activeZoneAssignments.map((row) => row.employment_id),
  );
  const personIds = Array.from(
    new Set(
      activeZoneAssignments
        .map((row) => employmentsById.get(row.employment_id)?.person_id ?? null)
        .filter((personId): personId is string => Boolean(personId) && personId !== params.excludingUserId),
    ),
  );

  if (personIds.length === 0) return [];

  const peopleById = await loadPeopleByIds(personIds);
  return personIds.filter((personId) => {
    const person = peopleById.get(personId);
    return person?.system_role === 'area_lead' && person.is_archived === false;
  });
}

async function loadManagerPrimaryConflict(params: {
  excludingUserId?: string;
  restaurantId: string;
  today: string;
}): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('role_scope_assignments')
    .select(
      'assignment_id, person_id, scope_type, scope_id, valid_from, valid_to, authority_tier, created_at',
    )
    .eq('scope_type', 'restaurant')
    .eq('scope_id', params.restaurantId)
    .eq('authority_tier', 'primary');

  if (error) {
    throw new Error(`Failed to load manager scope assignments: ${error.message}`);
  }

  const currentManagerScopes = ((data ?? []) as RoleScopeRow[]).filter(
    (row) =>
      row.person_id !== params.excludingUserId &&
      isCurrentTemporalRow(row, params.today),
  );

  if (currentManagerScopes.length === 0) return false;

  const peopleById = await loadPeopleByIds(
    Array.from(new Set(currentManagerScopes.map((scope) => scope.person_id))),
  );

  return currentManagerScopes.some(
    (scope) => peopleById.get(scope.person_id)?.system_role === 'manager',
  );
}

export async function getAreaLeadZoneConflictCode(params: {
  excludingUserId?: string;
  restaurantId: string;
  zoneId: string;
}): Promise<'area_lead_zone_full' | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('restaurant_zones')
    .select('id, restaurant_id')
    .eq('id', params.zoneId)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to load zone projection: ${error.message}`);
  }

  if (!data || (data as { restaurant_id: string }).restaurant_id !== params.restaurantId) {
    throw new Error('restaurant_mismatch');
  }

  const personIds = await loadAreaLeadConflictPersonIds({
    excludingUserId: params.excludingUserId,
    today: todayIsoDate(),
    zoneId: params.zoneId,
  });

  return personIds.length >= 2 ? 'area_lead_zone_full' : null;
}

export async function hasActiveAreaLead(personId: string): Promise<boolean> {
  const today = todayIsoDate();
  const peopleById = await loadPeopleByIds([personId]);
  const person = peopleById.get(personId);
  if (!person || person.is_archived || person.system_role !== 'area_lead') {
    return false;
  }

  const employment = await loadCurrentEmploymentForPerson(personId, today);
  if (!employment) return false;

  const [restaurantAssignment, zoneAssignment] = await Promise.all([
    loadCurrentRestaurantAssignment(employment.employment_id, today),
    loadCurrentZoneAssignment(employment.employment_id, today),
  ]);

  return Boolean(restaurantAssignment && zoneAssignment);
}

export async function getEmploymentRoleSlotConflictCode(
  restaurantId: string,
  _role: Extract<import('@/modules/employment/domain/employmentTypes').EditableEmployeeRole, 'manager'>,
  excludingUserId?: string,
): Promise<'manager_exists' | null> {
  const exists = await loadManagerPrimaryConflict({
    excludingUserId,
    restaurantId,
    today: todayIsoDate(),
  });

  return exists ? 'manager_exists' : null;
}
