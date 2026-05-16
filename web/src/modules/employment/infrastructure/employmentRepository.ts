import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import {
  type EditableEmploymentSystemRole,
  type EmploymentListItem,
  type EmploymentSystemRole,
} from '@/modules/employment/domain/employmentTypes';
import type { PersonProfile } from '@/modules/people';
import { coerceSystemRole, type SystemRole } from '@/shared/authz';

// internal
export type PersonRow = {
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

// internal
export type RestaurantAssignmentRow = {
  assignment_id: string;
  created_at: string;
  employment_id: string;
  restaurant_id: string;
  valid_from: string;
  valid_to: string | null;
};

// internal
export type ZoneAssignmentRow = {
  assignment_id: string;
  created_at: string;
  employment_id: string;
  valid_from: string;
  valid_to: string | null;
  zone_id: string;
};

// internal
export type RoleScopeRow = {
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

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function previousIsoDate(date: string): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}

export function isCurrentTemporalRow(
  row: { valid_from: string; valid_to: string | null },
  today = todayIsoDate(),
): boolean {
  return row.valid_from <= today && (row.valid_to === null || row.valid_to >= today);
}

export function compareTemporalDesc(
  left: { created_at?: string | null; valid_from: string },
  right: { created_at?: string | null; valid_from: string },
): number {
  return (
    right.valid_from.localeCompare(left.valid_from) ||
    (right.created_at ?? '').localeCompare(left.created_at ?? '')
  );
}

export function sortTemporalDesc<T extends { created_at?: string | null; valid_from: string }>(
  rows: T[],
): T[] {
  return [...rows].sort(compareTemporalDesc);
}

export function pickCurrentOrLatest<
  T extends { created_at?: string | null; valid_from: string; valid_to: string | null },
>(rows: T[], today = todayIsoDate()): T | null {
  return rows.find((row) => isCurrentTemporalRow(row, today)) ?? sortTemporalDesc(rows)[0] ?? null;
}

export function formatFullName(person: Pick<PersonRow, 'first_name' | 'last_name'>): string {
  return [person.first_name, person.last_name].filter(Boolean).join(' ').trim();
}

export function parseAccessStatus(
  accessStatus: string | null,
): PersonProfile['access_status'] {
  if (accessStatus === 'pending_activation') return 'pending_activation';
  if (accessStatus === 'active') return 'active';
  if (accessStatus === 'suspended') return 'suspended';
  if (accessStatus === 'archived') return 'archived';
  if (accessStatus === 'blocked') return 'blocked';
  return 'active';
}

export function mapSystemRoleToEmployment(systemRole: SystemRole): EmploymentSystemRole {
  if (systemRole === 'area_lead' || systemRole === 'manager' || systemRole === 'employee') {
    return systemRole;
  }

  return 'employee';
}

export function normalizeEditableEmploymentRole(
  value: string | null | undefined,
): EditableEmploymentSystemRole {
  if (value === 'area_lead' || value === 'manager') return value;
  return 'employee';
}

export async function loadPeopleByIds(personIds: string[]): Promise<Map<string, PersonRow>> {
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

export async function loadEmploymentsByIds(employmentIds: string[]): Promise<Map<string, EmploymentRow>> {
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
      .filter((row) => row.deleted_at === null)
      .map((row) => [row.employment_id, row]),
  );
}

export async function loadCurrentEmploymentForPerson(
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

export async function loadLatestEmploymentForPerson(personId: string): Promise<EmploymentRow | null> {
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

export async function loadRestaurantAssignmentsByEmploymentIds(
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

export async function loadZoneAssignmentsByEmploymentIds(
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

export async function loadCurrentRoleScopesForPerson(
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

export async function loadCurrentRestaurantAssignment(
  employmentId: string,
  today = todayIsoDate(),
): Promise<RestaurantAssignmentRow | null> {
  const assignments = await loadRestaurantAssignmentsByEmploymentIds([employmentId]);
  return pickCurrentOrLatest(assignments.get(employmentId) ?? [], today);
}

export async function loadCurrentZoneAssignment(
  employmentId: string,
  today = todayIsoDate(),
): Promise<ZoneAssignmentRow | null> {
  const assignments = await loadZoneAssignmentsByEmploymentIds([employmentId]);
  return pickCurrentOrLatest(assignments.get(employmentId) ?? [], today);
}

export async function loadCompanyByRestaurantId(restaurantId: string): Promise<{ companyId: string }> {
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
    access_status: parseAccessStatus(person.access_status),
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

export async function loadRestaurantZonesByRestaurantId(
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
