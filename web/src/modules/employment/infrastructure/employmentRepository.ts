import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import {
  type EditableEmployeeRole,
  type EditableEmploymentSystemRole,
  type EmploymentListItem,
  type EmploymentStatusFilter,
  type EmploymentSystemRole,
} from '@/modules/employment/domain/employmentTypes';
import type { PersonProfile } from '@/modules/people';
import { coerceSystemRole, type SystemRole } from '@/shared/authz';

type PersonRow = {
  access_status: string | null;
  agora_employee_id: string | null;
  avatar_url: string | null;
  first_name: string;
  is_archived: boolean;
  last_name: string;
  person_id: string;
  system_role: string;
  updated_at: string | null;
};

type EmploymentRow = {
  company_id: string;
  contract_type: string | null;
  created_at: string;
  deleted_at: string | null;
  employment_id: string;
  is_archived: boolean;
  job_title: string | null;
  person_id: string;
  requires_schedule: boolean | null;
  updated_at: string;
  valid_from: string;
  valid_to: string | null;
};

type RestaurantAssignmentRow = {
  assignment_id: string;
  created_at: string;
  employment_id: string;
  restaurant_id: string;
  valid_from: string;
  valid_to: string | null;
};

type ZoneAssignmentRow = {
  assignment_id: string;
  created_at: string;
  employment_id: string;
  valid_from: string;
  valid_to: string | null;
  zone_id: string;
};

type RoleScopeRow = {
  assignment_id: string;
  authority_tier: string | null;
  created_at: string;
  person_id: string;
  scope_id: string;
  scope_type: 'organization' | 'chain' | 'company' | 'restaurant' | 'zone';
  valid_from: string;
  valid_to: string | null;
};

type RestaurantRow = {
  company_id: string;
  id: string;
};

type UpdateEmploymentInput = {
  personId: string;
  restaurantId: string;
  role: EditableEmploymentSystemRole;
  zoneId: string | null;
};

type ActiveAssignmentSeed = {
  restaurant_id: string | null;
  role: EditableEmployeeRole;
  zone_id: string | null;
};

export type ScheduleActorProjection = {
  id: string;
  restaurant_id: string | null;
  system_role: SystemRole;
  zone_id: string | null;
};

export type EmploymentScopeProjection = {
  restaurant_id: string | null;
  zone_id: string | null;
};

export type RestaurantZoneSummary = {
  id: string;
  name: string;
};

export type EmployeesPageProjection = {
  employees: EmploymentListItem[];
  restaurantZones: RestaurantZoneSummary[];
};

export type EmployeeDetailPageProjection = {
  email: string;
  profile: PersonProfile;
  restaurantZones: RestaurantZoneSummary[];
};

export type RestaurantZonesMap = Record<string, RestaurantZoneSummary[]>;

const BAN_100_YEARS = '876600h';

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function previousIsoDate(date: string): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}

function isCurrentTemporalRow(
  row: { valid_from: string; valid_to: string | null },
  today = todayIsoDate(),
): boolean {
  return row.valid_from <= today && (row.valid_to === null || row.valid_to >= today);
}

function compareTemporalDesc(
  left: { created_at?: string | null; valid_from: string },
  right: { created_at?: string | null; valid_from: string },
): number {
  return (
    right.valid_from.localeCompare(left.valid_from) ||
    (right.created_at ?? '').localeCompare(left.created_at ?? '')
  );
}

function sortTemporalDesc<T extends { created_at?: string | null; valid_from: string }>(
  rows: T[],
): T[] {
  return [...rows].sort(compareTemporalDesc);
}

function pickCurrentOrLatest<
  T extends { created_at?: string | null; valid_from: string; valid_to: string | null },
>(rows: T[], today = todayIsoDate()): T | null {
  return rows.find((row) => isCurrentTemporalRow(row, today)) ?? sortTemporalDesc(rows)[0] ?? null;
}

function formatFullName(person: Pick<PersonRow, 'first_name' | 'last_name'>): string {
  return [person.first_name, person.last_name].filter(Boolean).join(' ').trim();
}

function parseAccessStatus(
  accessStatus: string | null,
  isArchived: boolean,
): PersonProfile['access_status'] {
  if (accessStatus === 'pending_activation') return 'pending_activation';
  if (accessStatus === 'active') return 'active';
  if (accessStatus === 'suspended') return 'suspended';
  if (accessStatus === 'archived') return 'archived';
  if (accessStatus === 'blocked') return 'blocked';
  return isArchived ? 'archived' : 'active';
}

function mapSystemRoleToEmployment(systemRole: SystemRole): EmploymentSystemRole {
  if (systemRole === 'area_lead' || systemRole === 'manager' || systemRole === 'employee') {
    return systemRole;
  }

  return 'employee';
}

function normalizeEditableEmploymentRole(
  value: string | null | undefined,
): EditableEmploymentSystemRole {
  if (value === 'area_lead' || value === 'manager') return value;
  return 'employee';
}

async function loadPeopleByIds(personIds: string[]): Promise<Map<string, PersonRow>> {
  if (personIds.length === 0) return new Map();

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('persons')
    .select(
      'person_id, system_role, first_name, last_name, avatar_url, agora_employee_id, is_archived, access_status, updated_at',
    )
    .in('person_id', personIds);

  if (error) {
    throw new Error(`Failed to load persons: ${error.message}`);
  }

  return new Map(((data ?? []) as PersonRow[]).map((row) => [row.person_id, row]));
}

async function loadEmploymentsByIds(employmentIds: string[]): Promise<Map<string, EmploymentRow>> {
  if (employmentIds.length === 0) return new Map();

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('employment_relationships')
    .select(
      'employment_id, person_id, company_id, job_title, contract_type, requires_schedule, valid_from, valid_to, created_at, updated_at, is_archived, deleted_at',
    )
    .in('employment_id', employmentIds);

  if (error) {
    throw new Error(`Failed to load employments: ${error.message}`);
  }

  return new Map(
    ((data ?? []) as EmploymentRow[])
      .filter((row) => !row.is_archived && row.deleted_at === null)
      .map((row) => [row.employment_id, row]),
  );
}

async function loadCurrentEmploymentForPerson(
  personId: string,
  today = todayIsoDate(),
): Promise<EmploymentRow | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('employment_relationships')
    .select(
      'employment_id, person_id, company_id, job_title, contract_type, requires_schedule, valid_from, valid_to, created_at, updated_at, is_archived, deleted_at',
    )
    .eq('person_id', personId)
    .eq('is_archived', false)
    .is('deleted_at', null)
    .order('valid_from', { ascending: false });

  if (error) {
    throw new Error(`Failed to load employment projection: ${error.message}`);
  }

  return ((data ?? []) as EmploymentRow[]).find((row) => isCurrentTemporalRow(row, today)) ?? null;
}

async function loadLatestEmploymentForPerson(personId: string): Promise<EmploymentRow | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('employment_relationships')
    .select(
      'employment_id, person_id, company_id, job_title, contract_type, requires_schedule, valid_from, valid_to, created_at, updated_at, is_archived, deleted_at',
    )
    .eq('person_id', personId)
    .order('valid_from', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`Failed to load employment seed: ${error.message}`);
  }

  return ((data ?? []) as EmploymentRow[])[0] ?? null;
}

async function loadRestaurantAssignmentsByEmploymentIds(
  employmentIds: string[],
): Promise<Map<string, RestaurantAssignmentRow[]>> {
  if (employmentIds.length === 0) return new Map();

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('employment_restaurant_assignments')
    .select('assignment_id, employment_id, restaurant_id, valid_from, valid_to, created_at')
    .in('employment_id', employmentIds)
    .order('valid_from', { ascending: false });

  if (error) {
    throw new Error(`Failed to load restaurant assignments: ${error.message}`);
  }

  const byEmploymentId = new Map<string, RestaurantAssignmentRow[]>();
  for (const row of (data ?? []) as RestaurantAssignmentRow[]) {
    const current = byEmploymentId.get(row.employment_id) ?? [];
    current.push(row);
    byEmploymentId.set(row.employment_id, current);
  }

  return byEmploymentId;
}

async function loadZoneAssignmentsByEmploymentIds(
  employmentIds: string[],
): Promise<Map<string, ZoneAssignmentRow[]>> {
  if (employmentIds.length === 0) return new Map();

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('employment_zone_assignments')
    .select('assignment_id, employment_id, zone_id, valid_from, valid_to, created_at')
    .in('employment_id', employmentIds)
    .order('valid_from', { ascending: false });

  if (error) {
    throw new Error(`Failed to load zone assignments: ${error.message}`);
  }

  const byEmploymentId = new Map<string, ZoneAssignmentRow[]>();
  for (const row of (data ?? []) as ZoneAssignmentRow[]) {
    const current = byEmploymentId.get(row.employment_id) ?? [];
    current.push(row);
    byEmploymentId.set(row.employment_id, current);
  }

  return byEmploymentId;
}

async function loadCurrentRoleScopesForPerson(
  personId: string,
  today = todayIsoDate(),
): Promise<RoleScopeRow[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('role_scope_assignments')
    .select(
      'assignment_id, person_id, scope_type, scope_id, valid_from, valid_to, authority_tier, created_at',
    )
    .eq('person_id', personId)
    .order('valid_from', { ascending: false });

  if (error) {
    throw new Error(`Failed to load role scope assignments: ${error.message}`);
  }

  return ((data ?? []) as RoleScopeRow[]).filter((row) => isCurrentTemporalRow(row, today));
}

async function loadCurrentRestaurantAssignment(
  employmentId: string,
  today = todayIsoDate(),
): Promise<RestaurantAssignmentRow | null> {
  const assignments = await loadRestaurantAssignmentsByEmploymentIds([employmentId]);
  return pickCurrentOrLatest(assignments.get(employmentId) ?? [], today);
}

async function loadCurrentZoneAssignment(
  employmentId: string,
  today = todayIsoDate(),
): Promise<ZoneAssignmentRow | null> {
  const assignments = await loadZoneAssignmentsByEmploymentIds([employmentId]);
  return pickCurrentOrLatest(assignments.get(employmentId) ?? [], today);
}

async function loadCompanyByRestaurantId(restaurantId: string): Promise<{ companyId: string }> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('restaurants')
    .select('id, company_id')
    .eq('id', restaurantId)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to load restaurant projection: ${error.message}`);
  }

  if (!data) {
    throw new Error('restaurant_invalid');
  }

  return {
    companyId: (data as RestaurantRow).company_id,
  };
}

export async function loadEmployeeProfileProjectionById(
  personId: string,
): Promise<PersonProfile> {
  const today = todayIsoDate();
  const peopleById = await loadPeopleByIds([personId]);
  const person = peopleById.get(personId);

  if (!person) {
    throw new Error(`Person not found: ${personId}`);
  }

  const employment = (await loadCurrentEmploymentForPerson(personId, today)) ??
    (await loadLatestEmploymentForPerson(personId));
  const systemRole = coerceSystemRole(person.system_role);

  const [restaurantAssignment, zoneAssignment, companyData] = employment
    ? await Promise.all([
        loadCurrentRestaurantAssignment(employment.employment_id, today),
        loadCurrentZoneAssignment(employment.employment_id, today),
        createSupabaseAdminClient()
          .from('companies')
          .select('chain_id')
          .eq('company_id', employment.company_id)
          .maybeSingle(),
      ])
    : [
        null,
        null,
        { data: null, error: null },
      ];

  const companyRow = (companyData.data ?? null) as { chain_id: string | null } | null;

  return {
    access_status: parseAccessStatus(person.access_status, person.is_archived),
    avatar_path: person.avatar_url,
    chain_id: companyRow?.chain_id ?? null,
    employee_code: Number.parseInt(person.agora_employee_id ?? '0', 10) || 0,
    full_name: formatFullName(person) || '(sin nombre)',
    id: person.person_id,
    is_archived: person.is_archived,
    restaurant_id: restaurantAssignment?.restaurant_id ?? null,
    system_role: systemRole,
    zone_id: zoneAssignment?.zone_id ?? null,
  };
}

async function loadRestaurantZonesByRestaurantId(
  restaurantId: string | null,
): Promise<RestaurantZoneSummary[]> {
  if (!restaurantId) return [];

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('restaurant_zones')
    .select('id, name')
    .eq('restaurant_id', restaurantId)
    .eq('is_active', true);

  if (error) {
    throw new Error(`Failed to load restaurant zones: ${error.message}`);
  }

  return (data ?? []) as RestaurantZoneSummary[];
}

export async function loadRestaurantZonesMap(
  restaurantIds: string[],
): Promise<RestaurantZonesMap> {
  if (restaurantIds.length === 0) return {};

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('restaurant_zones')
    .select('id, name, restaurant_id')
    .in('restaurant_id', restaurantIds)
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) {
    throw new Error(`Failed to load restaurant zones map: ${error.message}`);
  }

  const byRestaurantId: RestaurantZonesMap = {};
  for (const restaurantId of restaurantIds) {
    byRestaurantId[restaurantId] = [];
  }

  for (const row of (data ?? []) as Array<RestaurantZoneSummary & { restaurant_id: string }>) {
    byRestaurantId[row.restaurant_id] ??= [];
    byRestaurantId[row.restaurant_id].push({
      id: row.id,
      name: row.name,
    });
  }

  return byRestaurantId;
}

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

export async function loadEmployeeDetailPageProjection(
  personId: string,
): Promise<EmployeeDetailPageProjection> {
  const profile = await loadEmployeeProfileProjectionById(personId);
  const admin = createSupabaseAdminClient();
  const [{ data: authUser, error: authError }, restaurantZones] = await Promise.all([
    admin.auth.admin.getUserById(personId),
    loadRestaurantZonesByRestaurantId(profile.restaurant_id),
  ]);

  if (authError) {
    throw new Error(`Failed to load auth user: ${authError.message}`);
  }

  return {
    email: authUser.user?.email ?? '',
    profile,
    restaurantZones,
  };
}

async function replaceTemporalRows(params: {
  currentRows: Array<{ assignment_id: string; valid_from: string }>;
  table:
    | 'employment_restaurant_assignments'
    | 'employment_zone_assignments'
    | 'role_scope_assignments';
  today: string;
}): Promise<void> {
  const admin = createSupabaseAdminClient();
  const deleteIds = params.currentRows
    .filter((row) => row.valid_from >= params.today)
    .map((row) => row.assignment_id);
  const closeIds = params.currentRows
    .filter((row) => row.valid_from < params.today)
    .map((row) => row.assignment_id);

  if (deleteIds.length > 0) {
    const { error } = await admin
      .from(params.table)
      .delete()
      .in('assignment_id', deleteIds);

    if (error) {
      throw new Error(`Failed to replace temporal rows: ${error.message}`);
    }
  }

  if (closeIds.length > 0) {
    const { error } = await admin
      .from(params.table)
      .update({ valid_to: previousIsoDate(params.today) })
      .in('assignment_id', closeIds);

    if (error) {
      throw new Error(`Failed to close temporal rows: ${error.message}`);
    }
  }
}

async function ensureZoneBelongsToRestaurant(zoneId: string, restaurantId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('restaurant_zones')
    .select('id, restaurant_id')
    .eq('id', zoneId)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to load zone projection: ${error.message}`);
  }

  if (!data || (data as { restaurant_id: string }).restaurant_id !== restaurantId) {
    throw new Error('restaurant_mismatch');
  }
}

async function syncPersonEmploymentProjection(params: {
  personId: string;
  systemRole: EditableEmploymentSystemRole;
}): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from('persons')
    .update({
      deleted_at: null,
      is_archived: false,
      system_role: params.systemRole,
      updated_at: new Date().toISOString(),
    })
    .eq('person_id', params.personId);

  if (error) {
    throw new Error(`Failed to sync person projection: ${error.message}`);
  }
}

async function ensureEmploymentRow(params: {
  companyId: string;
  personId: string;
  role: EditableEmploymentSystemRole;
  today: string;
}): Promise<string> {
  const admin = createSupabaseAdminClient();
  const currentEmployment = await loadCurrentEmploymentForPerson(params.personId, params.today);

  if (!currentEmployment) {
    const { data, error } = await admin
      .from('employment_relationships')
      .insert({
        company_id: params.companyId,
        job_title: params.role,
        person_id: params.personId,
        requires_schedule: true,
        valid_from: params.today,
      })
      .select('employment_id')
      .single();

    if (error) {
      throw new Error(`Failed to create employment relationship: ${error.message}`);
    }

    return (data as { employment_id: string }).employment_id;
  }

  if (currentEmployment.company_id === params.companyId || currentEmployment.valid_from >= params.today) {
    const { error } = await admin
      .from('employment_relationships')
      .update({
        company_id: params.companyId,
        job_title: params.role,
        requires_schedule: true,
      })
      .eq('employment_id', currentEmployment.employment_id);

    if (error) {
      throw new Error(`Failed to update employment relationship: ${error.message}`);
    }

    return currentEmployment.employment_id;
  }

  const { error: closeError } = await admin
    .from('employment_relationships')
    .update({ valid_to: previousIsoDate(params.today) })
    .eq('employment_id', currentEmployment.employment_id);

  if (closeError) {
    throw new Error(`Failed to close employment relationship: ${closeError.message}`);
  }

  const { data, error: insertError } = await admin
    .from('employment_relationships')
    .insert({
      company_id: params.companyId,
      job_title: params.role,
      person_id: params.personId,
      requires_schedule: true,
      valid_from: params.today,
    })
    .select('employment_id')
    .single();

  if (insertError) {
    throw new Error(`Failed to recreate employment relationship: ${insertError.message}`);
  }

  return (data as { employment_id: string }).employment_id;
}

async function replaceRestaurantAssignments(params: {
  employmentId: string;
  restaurantId: string;
  today: string;
}): Promise<void> {
  const assignmentsByEmploymentId = await loadRestaurantAssignmentsByEmploymentIds([params.employmentId]);
  const currentRows = (assignmentsByEmploymentId.get(params.employmentId) ?? []).filter((row) =>
    isCurrentTemporalRow(row, params.today),
  );

  const currentTarget = currentRows.find((row) => row.restaurant_id === params.restaurantId);
  if (currentRows.length === 1 && currentTarget) {
    return;
  }

  await replaceTemporalRows({
    currentRows,
    table: 'employment_restaurant_assignments',
    today: params.today,
  });

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from('employment_restaurant_assignments').insert({
    employment_id: params.employmentId,
    restaurant_id: params.restaurantId,
    transfer_reason: 'manual_assignment',
    valid_from: params.today,
  });

  if (error) {
    throw new Error(`Failed to replace restaurant assignments: ${error.message}`);
  }
}

async function replaceZoneAssignments(params: {
  employmentId: string;
  today: string;
  zoneId: string | null;
}): Promise<void> {
  const assignmentsByEmploymentId = await loadZoneAssignmentsByEmploymentIds([params.employmentId]);
  const currentRows = (assignmentsByEmploymentId.get(params.employmentId) ?? []).filter((row) =>
    isCurrentTemporalRow(row, params.today),
  );

  const currentTarget = params.zoneId
    ? currentRows.find((row) => row.zone_id === params.zoneId)
    : null;

  if (
    (params.zoneId === null && currentRows.length === 0) ||
    (params.zoneId && currentRows.length === 1 && currentTarget)
  ) {
    return;
  }

  await replaceTemporalRows({
    currentRows,
    table: 'employment_zone_assignments',
    today: params.today,
  });

  if (!params.zoneId) return;

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from('employment_zone_assignments').insert({
    employment_id: params.employmentId,
    valid_from: params.today,
    zone_id: params.zoneId,
  });

  if (error) {
    throw new Error(`Failed to replace zone assignments: ${error.message}`);
  }
}

async function replaceRoleScopes(params: {
  personId: string;
  restaurantId: string;
  role: EditableEmploymentSystemRole;
  today: string;
  zoneId: string | null;
}): Promise<void> {
  const currentScopes = await loadCurrentRoleScopesForPerson(params.personId, params.today);

  let desiredScope:
    | { authority_tier: string | null; scope_id: string; scope_type: RoleScopeRow['scope_type'] }
    | null = null;

  if (params.role === 'manager') {
    desiredScope = {
      authority_tier: 'primary',
      scope_id: params.restaurantId,
      scope_type: 'restaurant',
    };
  } else if (params.role === 'area_lead' && params.zoneId) {
    desiredScope = {
      authority_tier: null,
      scope_id: params.zoneId,
      scope_type: 'zone',
    };
  }

  if (
    desiredScope &&
    currentScopes.length === 1 &&
    currentScopes[0].scope_id === desiredScope.scope_id &&
    currentScopes[0].scope_type === desiredScope.scope_type &&
    currentScopes[0].authority_tier === desiredScope.authority_tier
  ) {
    return;
  }

  await replaceTemporalRows({
    currentRows: currentScopes,
    table: 'role_scope_assignments',
    today: params.today,
  });

  if (!desiredScope) return;

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from('role_scope_assignments').insert({
    authority_tier: desiredScope.authority_tier,
    person_id: params.personId,
    scope_id: desiredScope.scope_id,
    scope_type: desiredScope.scope_type,
    valid_from: params.today,
  });

  if (error) {
    throw new Error(`Failed to replace role scopes: ${error.message}`);
  }
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
  await ensureZoneBelongsToRestaurant(params.zoneId, params.restaurantId);

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

export async function loadEmploymentScopeProjection(
  personId: string,
): Promise<EmploymentScopeProjection | null> {
  const today = todayIsoDate();
  const employment = await loadCurrentEmploymentForPerson(personId, today);
  if (!employment) return null;

  const [restaurantAssignment, zoneAssignment] = await Promise.all([
    loadCurrentRestaurantAssignment(employment.employment_id, today),
    loadCurrentZoneAssignment(employment.employment_id, today),
  ]);

  if (!restaurantAssignment) return null;

  return {
    restaurant_id: restaurantAssignment.restaurant_id,
    zone_id: zoneAssignment?.zone_id ?? null,
  };
}

export async function loadEmployeeScopeProjection(
  personId: string,
): Promise<EmploymentScopeProjection | null> {
  return loadEmploymentScopeProjection(personId);
}

export async function loadScheduleActorProjection(
  personId: string,
): Promise<ScheduleActorProjection | null> {
  const peopleById = await loadPeopleByIds([personId]);
  const person = peopleById.get(personId);
  if (!person || person.is_archived) return null;

  const scope = await loadEmployeeScopeProjection(personId);

  return {
    id: person.person_id,
    restaurant_id: scope?.restaurant_id ?? null,
    system_role: coerceSystemRole(person.system_role),
    zone_id: scope?.zone_id ?? null,
  };
}

export async function listEmploymentForRestaurantProjection(
  restaurantId: string,
  status: EmploymentStatusFilter = 'active',
): Promise<EmploymentListItem[]> {
  const today = todayIsoDate();
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('employment_restaurant_assignments')
    .select('assignment_id, employment_id, restaurant_id, valid_from, valid_to, created_at')
    .eq('restaurant_id', restaurantId)
    .order('valid_from', { ascending: false });

  if (error) {
    throw new Error(`Failed to list restaurant assignments: ${error.message}`);
  }

  const restaurantAssignments = (data ?? []) as RestaurantAssignmentRow[];
  const employmentsById = await loadEmploymentsByIds(
    Array.from(new Set(restaurantAssignments.map((row) => row.employment_id))),
  );
  const relevantAssignments = restaurantAssignments.filter((assignment) =>
    employmentsById.has(assignment.employment_id),
  );

  const peopleById = await loadPeopleByIds(
    Array.from(
      new Set(
        relevantAssignments
          .map((assignment) => employmentsById.get(assignment.employment_id)?.person_id ?? null)
          .filter((personId): personId is string => Boolean(personId)),
      ),
    ),
  );
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
    if (systemRole !== 'employee' && systemRole !== 'manager' && systemRole !== 'area_lead') {
      continue;
    }

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
    if (!existing || (!existing.is_active && isActive)) {
      itemsByPersonId.set(person.person_id, nextItem);
    }
  }

  const items = Array.from(itemsByPersonId.values()).sort(
    (left, right) => left.employee_code - right.employee_code,
  );

  if (status === 'active') return items.filter((item) => item.is_active);
  if (status === 'inactive') return items.filter((item) => !item.is_active);
  return items;
}

export async function getEmploymentRoleSlotConflictCode(
  restaurantId: string,
  _role: Extract<EditableEmployeeRole, 'manager'>,
  excludingUserId?: string,
): Promise<'manager_exists' | null> {
  const exists = await loadManagerPrimaryConflict({
    excludingUserId,
    restaurantId,
    today: todayIsoDate(),
  });

  return exists ? 'manager_exists' : null;
}

async function loadEmploymentActivationSeed(
  personId: string,
): Promise<ActiveAssignmentSeed | null> {
  const employment = await loadLatestEmploymentForPerson(personId);
  if (!employment) return null;

  const [restaurantAssignment, zoneAssignment] = await Promise.all([
    loadCurrentRestaurantAssignment(employment.employment_id),
    loadCurrentZoneAssignment(employment.employment_id),
  ]);

  return {
    restaurant_id: restaurantAssignment?.restaurant_id ?? null,
    role: normalizeEditableEmploymentRole(employment.job_title),
    zone_id: zoneAssignment?.zone_id ?? null,
  };
}

async function deactivateEmploymentProjection(personId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  const timestamp = new Date().toISOString();
  const today = todayIsoDate();

  const currentEmployment = await loadCurrentEmploymentForPerson(personId, today);
  if (currentEmployment) {
    const [restaurantAssignments, zoneAssignments, currentScopes] = await Promise.all([
      loadRestaurantAssignmentsByEmploymentIds([currentEmployment.employment_id]),
      loadZoneAssignmentsByEmploymentIds([currentEmployment.employment_id]),
      loadCurrentRoleScopesForPerson(personId, today),
    ]);

    const activeRestaurantAssignments = (
      restaurantAssignments.get(currentEmployment.employment_id) ?? []
    ).filter((row) => isCurrentTemporalRow(row, today));
    const activeZoneAssignments = (
      zoneAssignments.get(currentEmployment.employment_id) ?? []
    ).filter((row) => isCurrentTemporalRow(row, today));

    if (activeRestaurantAssignments.length > 0) {
      const { error } = await admin
        .from('employment_restaurant_assignments')
        .update({ valid_to: today })
        .in(
          'assignment_id',
          activeRestaurantAssignments.map((row) => row.assignment_id),
        );

      if (error) {
        throw new Error(`Failed to deactivate restaurant assignments: ${error.message}`);
      }
    }

    if (activeZoneAssignments.length > 0) {
      const { error } = await admin
        .from('employment_zone_assignments')
        .update({ valid_to: today })
        .in(
          'assignment_id',
          activeZoneAssignments.map((row) => row.assignment_id),
        );

      if (error) {
        throw new Error(`Failed to deactivate zone assignments: ${error.message}`);
      }
    }

    if (currentScopes.length > 0) {
      const { error } = await admin
        .from('role_scope_assignments')
        .update({ valid_to: today })
        .in(
          'assignment_id',
          currentScopes.map((row) => row.assignment_id),
        );

      if (error) {
        throw new Error(`Failed to deactivate role scopes: ${error.message}`);
      }
    }

    const { error: employmentError } = await admin
      .from('employment_relationships')
      .update({ valid_to: today })
      .eq('employment_id', currentEmployment.employment_id);

    if (employmentError) {
      throw new Error(`Failed to deactivate employment relationship: ${employmentError.message}`);
    }
  }

  const { error: personError } = await admin
    .from('persons')
    .update({
      access_status: 'archived',
      deleted_at: timestamp,
      is_archived: true,
      updated_at: timestamp,
    })
    .eq('person_id', personId);

  if (personError) {
    throw new Error(`Failed to deactivate person projection: ${personError.message}`);
  }
}

export async function updateEmploymentProjection(input: UpdateEmploymentInput): Promise<void> {
  const today = todayIsoDate();
  const normalizedZoneId =
    input.role === 'employee' || input.role === 'area_lead' ? input.zoneId : null;

  if (input.role === 'area_lead' && !normalizedZoneId) {
    throw new Error('area_lead_requires_zone');
  }

  if (normalizedZoneId) {
    await ensureZoneBelongsToRestaurant(normalizedZoneId, input.restaurantId);
  }

  if (input.role === 'area_lead' && normalizedZoneId) {
    const conflict = await getAreaLeadZoneConflictCode({
      excludingUserId: input.personId,
      restaurantId: input.restaurantId,
      zoneId: normalizedZoneId,
    });

    if (conflict) {
      throw new Error(conflict);
    }
  }

  if (input.role === 'manager') {
    const conflict = await getEmploymentRoleSlotConflictCode(
      input.restaurantId,
      'manager',
      input.personId,
    );

    if (conflict) {
      throw new Error(conflict);
    }
  }

  const restaurant = await loadCompanyByRestaurantId(input.restaurantId);

  await syncPersonEmploymentProjection({
    personId: input.personId,
    systemRole: input.role,
  });

  const employmentId = await ensureEmploymentRow({
    companyId: restaurant.companyId,
    personId: input.personId,
    role: input.role,
    today,
  });

  await replaceRestaurantAssignments({
    employmentId,
    restaurantId: input.restaurantId,
    today,
  });

  await replaceZoneAssignments({
    employmentId,
    today,
    zoneId: input.role === 'area_lead' ? normalizedZoneId : null,
  });

  await replaceRoleScopes({
    personId: input.personId,
    restaurantId: input.restaurantId,
    role: input.role,
    today,
    zoneId: normalizedZoneId,
  });
}

export async function setEmploymentActiveProjection(
  personId: string,
  isActive: boolean,
): Promise<void> {
  const admin = createSupabaseAdminClient();

  if (isActive) {
    const { error: personError } = await admin
      .from('persons')
      .update({
        access_status: 'active',
        deleted_at: null,
        is_archived: false,
        updated_at: new Date().toISOString(),
      })
      .eq('person_id', personId);

    if (personError) {
      throw new Error(`Failed to reactivate person projection: ${personError.message}`);
    }

    const seed = await loadEmploymentActivationSeed(personId);
    if (seed?.restaurant_id) {
      await updateEmploymentProjection({
        personId,
        restaurantId: seed.restaurant_id,
        role: seed.role,
        zoneId: seed.zone_id ?? null,
      });
    }
  } else {
    await deactivateEmploymentProjection(personId);
  }

  const { error: authError } = await admin.auth.admin.updateUserById(personId, {
    ban_duration: isActive ? 'none' : BAN_100_YEARS,
  });

  if (authError) {
    throw new Error(`Failed to update employment auth ban: ${authError.message}`);
  }
}
