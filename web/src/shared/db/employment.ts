import 'server-only';

import type { SystemRole } from '@/modules/authz';
import {
  type EditableEmployeeRole,
  type EditableEmploymentSystemRole,
  type EmploymentListItem,
  type EmploymentStatusFilter,
  type EmploymentSystemRole,
} from '@/modules/employment/domain/employmentTypes';
import { createSupabaseAdminClient } from '@/shared/supabase/admin';

type UpdateEmploymentInput = {
  personId: string;
  restaurantId: string;
  role: EditableEmploymentSystemRole;
  zoneId: string | null;
};

type EmploymentProjectionRow = {
  active_principal: boolean;
  is_archived: boolean;
  person_id: string;
  restaurant_id: string;
  updated_at: string;
};

type ActiveZoneScopeRow = {
  scope_id: string | null;
};

type PersonIdRow = {
  person_id: string;
};

type PersonProjectionRow = {
  person_id: string;
  system_role: SystemRole;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  agora_employee_id: string | null;
  is_archived: boolean;
  onboarding_status: string;
};

type PersonSystemRoleRow = {
  person_id: string;
  system_role: SystemRole;
};

type PersonZoneScopeAssignmentRow = {
  person_id: string;
  scope_id: string | null;
};

type RestaurantProjectionRow = {
  chain_id: string | null;
  company_id: string | null;
  id: string;
};

type ActiveEmploymentRecordRow = {
  employment_id: string;
};

type EmploymentActivationSeedRow = {
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

// Deprecated profile-table types removed since profiles no longer exists.
// Projection now comes from persons + employment_relationships.

const BAN_100_YEARS = '876600h';
const CANONICAL_MIGRATED_CHAIN_ID = '00000000-0000-0000-0000-000000000001';
const CANONICAL_MIGRATED_COMPANY_ID = '00000000-0000-0000-0000-000000000002';

function mapSystemRoleToEmployment(
  systemRole: SystemRole,
): EmploymentSystemRole {
  if (
    systemRole === 'area_lead' ||
    systemRole === 'manager' ||
    systemRole === 'sub_manager' ||
    systemRole === 'employee'
  ) {
    return systemRole;
  }

  return 'employee';
}

export async function getAreaLeadZoneConflictCode(params: {
  excludingUserId?: string;
  restaurantId: string;
  zoneId: string;
}): Promise<'area_lead_zone_full' | null> {
  const admin = createSupabaseAdminClient();
  const { data: employmentRows, error: employmentError } = await admin
    .from('employment_relationships')
    .select('person_id')
    .eq('restaurant_id', params.restaurantId)
    .eq('active_principal', true)
    .eq('is_archived', false);

  if (employmentError) {
    throw new Error(`Failed to load employment projection: ${employmentError.message}`);
  }

  const restaurantPersonIds = ((employmentRows ?? []) as PersonIdRow[])
    .map((row) => row.person_id)
    .filter((personId) => personId !== params.excludingUserId);

  if (restaurantPersonIds.length === 0) return null;

  const { data: scopeRows, error: scopeError } = await admin
    .from('role_scope_assignments')
    .select('person_id')
    .in('person_id', restaurantPersonIds)
    .eq('scope_type', 'zone')
    .eq('scope_id', params.zoneId)
    .eq('active', true);

  if (scopeError) {
    throw new Error(`Failed to load zone scope assignments: ${scopeError.message}`);
  }

  const zonePersonIds = Array.from(
    new Set(((scopeRows ?? []) as PersonIdRow[]).map((row) => row.person_id)),
  );
  if (zonePersonIds.length === 0) return null;

  const { data: personRows, error: personError } = await admin
    .from('persons')
    .select('person_id')
    .in('person_id', zonePersonIds)
    .eq('system_role', 'area_lead')
    .eq('is_archived', false)
    .limit(2);

  if (personError) {
    throw new Error(`Failed to load area lead projection: ${personError.message}`);
  }

  return ((personRows ?? []) as PersonIdRow[]).length >= 2 ? 'area_lead_zone_full' : null;
}

export async function hasActiveAreaLead(personId: string): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  const [{ data: personRows, error: personError }, { data: employmentRows, error: employmentError }] =
    await Promise.all([
      admin
        .from('persons')
        .select('person_id')
        .eq('person_id', personId)
        .eq('system_role', 'area_lead')
        .eq('is_archived', false)
        .limit(1),
      admin
        .from('employment_relationships')
        .select('person_id')
        .eq('person_id', personId)
        .eq('active_principal', true)
        .eq('is_archived', false)
        .limit(1),
    ]);

  if (personError) {
    throw new Error(`Failed to load area lead projection: ${personError.message}`);
  }

  if (employmentError) {
    throw new Error(`Failed to load employment projection: ${employmentError.message}`);
  }

  return ((personRows ?? []) as PersonIdRow[]).length > 0 &&
    ((employmentRows ?? []) as PersonIdRow[]).length > 0;
}

export async function loadEmploymentScopeProjection(
  personId: string,
): Promise<EmploymentScopeProjection | null> {
  const admin = createSupabaseAdminClient();
  const [{ data: employment, error: employmentError }, { data: zoneScope, error: zoneScopeError }] =
    await Promise.all([
      admin
        .from('employment_relationships')
        .select('restaurant_id')
        .eq('person_id', personId)
        .eq('active_principal', true)
        .eq('is_archived', false)
        .maybeSingle(),
      admin
        .from('role_scope_assignments')
        .select('scope_id')
        .eq('person_id', personId)
        .eq('scope_type', 'zone')
        .eq('active', true)
        .maybeSingle(),
    ]);

  if (employmentError && employmentError.code !== 'PGRST116') {
    throw new Error(`Failed to load employment projection: ${employmentError.message}`);
  }

  if (zoneScopeError && zoneScopeError.code !== 'PGRST116') {
    throw new Error(`Failed to load zone scope projection: ${zoneScopeError.message}`);
  }

  if (!employment) return null;

  return {
    restaurant_id: (employment as { restaurant_id: string | null }).restaurant_id ?? null,
    zone_id: ((zoneScope ?? null) as ActiveZoneScopeRow | null)?.scope_id ?? null,
  };
}

export async function loadEmployeeScopeProjection(
  personId: string,
): Promise<EmploymentScopeProjection | null> {
  // Now simply using the v6 projection as profiles is gone
  return loadEmploymentScopeProjection(personId);
}

export async function loadScheduleActorProjection(
  personId: string,
): Promise<ScheduleActorProjection | null> {
  const admin = createSupabaseAdminClient();
  const [{ data: person, error: personError }, scope] = await Promise.all([
    admin
      .from('persons')
      .select('person_id, system_role')
      .eq('person_id', personId)
      .eq('is_archived', false)
      .maybeSingle(),
    loadEmployeeScopeProjection(personId),
  ]);

  if (personError && personError.code !== 'PGRST116') {
    throw new Error(`Failed to load person role projection: ${personError.message}`);
  }

  if (!person) return null;

  const typedPerson = person as PersonSystemRoleRow;
  return {
    id: typedPerson.person_id,
    restaurant_id: scope?.restaurant_id ?? null,
    system_role: typedPerson.system_role,
    zone_id: scope?.zone_id ?? null,
  };
}

async function listEmploymentFromProjection(
  restaurantId: string,
  status: EmploymentStatusFilter,
): Promise<EmploymentListItem[]> {
  const admin = createSupabaseAdminClient();
  let query = admin
    .from('employment_relationships')
    .select('person_id, restaurant_id, active_principal, is_archived, updated_at')
    .eq('restaurant_id', restaurantId)
    .order('updated_at', { ascending: false });

  if (status === 'active') {
    query = query.eq('active_principal', true).eq('is_archived', false);
  }

  const { data: employmentRows, error: employmentError } = await query;

  if (employmentError) {
    throw new Error(`Failed to list employment projection: ${employmentError.message}`);
  }

  const typedEmploymentRows = ((employmentRows ?? []) as EmploymentProjectionRow[])
    .filter((row) => {
      if (status === 'inactive') {
        return row.is_archived || row.active_principal === false;
      }

      return true;
    })
    .filter((row, index, rows) =>
      rows.findIndex((candidate) => candidate.person_id === row.person_id) === index,
    );
  const personIds = Array.from(new Set(typedEmploymentRows.map((row) => row.person_id)));
  if (personIds.length === 0) return [];

  const [
    { data: persons, error: personsError },
    { data: zoneScopes, error: zoneScopesError },
  ] =
    await Promise.all([
      admin
        .from('persons')
        .select('person_id, system_role, first_name, last_name, avatar_url, agora_employee_id, is_archived, onboarding_status')
        .in('person_id', personIds),
      admin
        .from('role_scope_assignments')
        .select('person_id, scope_id')
        .in('person_id', personIds)
        .eq('scope_type', 'zone')
        .eq('active', true),
    ]);

  if (personsError) {
    throw new Error(`Failed to load person roles: ${personsError.message}`);
  }

  if (zoneScopesError) {
    throw new Error(`Failed to load zone scope assignments: ${zoneScopesError.message}`);
  }

  const personsById = new Map<string, PersonProjectionRow>(
    ((persons ?? []) as PersonProjectionRow[]).map((row) => [row.person_id, row]),
  );
  const zoneScopesByPersonId = new Map(
    ((zoneScopes ?? []) as PersonZoneScopeAssignmentRow[]).map((row) => [
      row.person_id,
      row.scope_id ?? null,
    ]),
  );

  const items: EmploymentListItem[] = [];

  for (const employment of typedEmploymentRows) {
    const projectedPerson = personsById.get(employment.person_id);
    if (!projectedPerson) continue;

    const projectedSystemRole = mapSystemRoleToEmployment(projectedPerson.system_role);

    const fullName = [projectedPerson.first_name, projectedPerson.last_name]
      .filter(Boolean)
      .join(' ')
      .trim();

    const employeeCode = parseInt(projectedPerson.agora_employee_id || '0', 10);

    items.push({
      avatar_path: projectedPerson.avatar_url,
      employee_code: isNaN(employeeCode) ? 0 : employeeCode,
      full_name: fullName || '(sin nombre)',
      id: projectedPerson.person_id,
      is_active:
        employment.active_principal &&
        !employment.is_archived &&
        projectedPerson.onboarding_status === 'active' &&
        projectedPerson.is_archived !== true,
      restaurant_id: employment.restaurant_id,
      system_role: projectedSystemRole,
      zone_id: zoneScopesByPersonId.get(projectedPerson.person_id) ?? null,
    });
  }

  return items.sort((left, right) => left.employee_code - right.employee_code);
}

export async function listEmploymentForRestaurant(
  restaurantId: string,
  status: EmploymentStatusFilter = 'active',
): Promise<EmploymentListItem[]> {
  return listEmploymentFromProjection(restaurantId, status);
}

async function loadRestaurantProjection(
  restaurantId: string,
): Promise<RestaurantProjectionRow> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('restaurants')
    .select('id, chain_id, company_id')
    .eq('id', restaurantId)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to load restaurant projection: ${error.message}`);
  }

  if (!data) {
    throw new Error('restaurant_invalid');
  }

  return data as RestaurantProjectionRow;
}

async function syncPersonEmploymentProjection(params: {
  chainId: string;
  personId: string;
  systemRole: EditableEmploymentSystemRole;
}): Promise<void> {
  const admin = createSupabaseAdminClient();
  const payload = {
    chain_id: params.chainId,
    deleted_at: null,
    is_archived: false,
    system_role: params.systemRole,
  };
  const { data, error } = await admin
    .from('persons')
    .update(payload)
    .eq('person_id', params.personId)
    .select('person_id');

  if (error) {
    throw new Error(`Failed to sync person projection: ${error.message}`);
  }

  if (((data ?? []) as Array<{ person_id: string }>).length > 0) {
    return;
  }

  const { error: bootstrapError } = await admin.rpc('sync_legacy_person_projection', {
    p_profile_id: params.personId,
  });

  if (bootstrapError) {
    throw new Error(
      `Failed to bootstrap person projection before sync: ${bootstrapError.message}`,
    );
  }

  const { error: retryError } = await admin
    .from('persons')
    .update(payload)
    .eq('person_id', params.personId);

  if (retryError) {
    throw new Error(`Failed to sync person projection after bootstrap: ${retryError.message}`);
  }
}

async function syncEmploymentRelationshipProjection(params: {
  companyId: string;
  personId: string;
  restaurantId: string;
  systemRole: EditableEmploymentSystemRole;
}): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { data: activeEmployment, error: employmentError } = await admin
    .from('employment_relationships')
    .select('employment_id')
    .eq('person_id', params.personId)
    .eq('active_principal', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (employmentError && employmentError.code !== 'PGRST116') {
    throw new Error(`Failed to load employment relationship: ${employmentError.message}`);
  }

  const payload = {
    company_id: params.companyId,
    deleted_at: null,
    end_date: null,
    is_archived: false,
    job_title: params.systemRole,
    person_id: params.personId,
    requires_schedule: true,
    restaurant_id: params.restaurantId,
  };

  const activeEmploymentId =
    (activeEmployment as ActiveEmploymentRecordRow | null)?.employment_id ?? null;

  if (!activeEmploymentId) {
    const { error: insertError } = await admin
      .from('employment_relationships')
      .insert({
        ...payload,
        active_principal: true,
      });

    if (insertError) {
      throw new Error(`Failed to create employment relationship: ${insertError.message}`);
    }

    return;
  }

  const { error: updateError } = await admin
    .from('employment_relationships')
    .update({
      ...payload,
      active_principal: true,
    })
    .eq('employment_id', activeEmploymentId);

  if (updateError) {
    throw new Error(`Failed to update employment relationship: ${updateError.message}`);
  }
}

async function syncRoleScopeProjection(params: {
  personId: string;
  restaurantId: string;
  systemRole: EditableEmploymentSystemRole;
  zoneId: string | null;
}): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { error: deactivateError } = await admin
    .from('role_scope_assignments')
    .update({ active: false })
    .eq('person_id', params.personId)
    .eq('active', true);

  if (deactivateError) {
    throw new Error(`Failed to deactivate role scopes: ${deactivateError.message}`);
  }

  const scopeType = params.systemRole === 'area_lead' ? 'zone' : 'restaurant';
  const scopeId =
    params.systemRole === 'area_lead' ? params.zoneId : params.restaurantId;

  const { error: insertError } = await admin
    .from('role_scope_assignments')
    .insert({
      active: true,
      person_id: params.personId,
      scope_id: scopeId,
      scope_type: scopeType,
    });

  if (insertError) {
    throw new Error(`Failed to create role scope assignment: ${insertError.message}`);
  }
}

async function loadEmploymentActivationSeed(
  personId: string,
): Promise<EmploymentActivationSeedRow | null> {
  const admin = createSupabaseAdminClient();
  const [{ data: employment }, { data: scope }] = await Promise.all([
    admin
      .from('employment_relationships')
      .select('restaurant_id, job_title')
      .eq('person_id', personId)
      .eq('active_principal', true)
      .maybeSingle(),
    admin
      .from('role_scope_assignments')
      .select('scope_id')
      .eq('person_id', personId)
      .eq('scope_type', 'zone')
      .eq('active', true)
      .maybeSingle(),
  ]);

  if (!employment) return null;

  const typedEmployment = employment as { restaurant_id: string; job_title: string };
  const typedScope = scope as { scope_id: string } | null;

  return {
    restaurant_id: typedEmployment.restaurant_id,
    role: typedEmployment.job_title as EditableEmployeeRole,
    zone_id: typedScope?.scope_id ?? null,
  };
}

async function deactivateEmploymentProjection(personId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  const timestamp = new Date().toISOString();
  const today = timestamp.slice(0, 10);

  const { error: personError } = await admin
    .from('persons')
    .update({
      deleted_at: timestamp,
      is_archived: true,
    })
    .eq('person_id', personId);

  if (personError) {
    throw new Error(`Failed to deactivate person projection: ${personError.message}`);
  }

  const { error: scopeError } = await admin
    .from('role_scope_assignments')
    .update({ active: false })
    .eq('person_id', personId)
    .eq('active', true);

  if (scopeError) {
    throw new Error(`Failed to deactivate scope assignments: ${scopeError.message}`);
  }

  const { error: employmentError } = await admin
    .from('employment_relationships')
    .update({
      active_principal: false,
      deleted_at: timestamp,
      end_date: today,
      is_archived: true,
    })
    .eq('person_id', personId)
    .eq('active_principal', true)
    .eq('is_archived', false);

  if (employmentError) {
    throw new Error(`Failed to deactivate employment relationship: ${employmentError.message}`);
  }
}

export async function updateEmployment(
  input: UpdateEmploymentInput,
): Promise<void> {
  const normalizedZoneId =
    input.role === 'employee' || input.role === 'area_lead' ? input.zoneId : null;

  if (input.role === 'area_lead' && !normalizedZoneId) {
    throw new Error('area_lead_requires_zone');
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

  if (input.role === 'manager' || input.role === 'sub_manager') {
    const conflict = await getEmploymentRoleSlotConflictCode(
      input.restaurantId,
      input.role,
      input.personId,
    );

    if (conflict) {
      throw new Error(conflict);
    }
  }

  const restaurant = await loadRestaurantProjection(input.restaurantId);
  await syncPersonEmploymentProjection({
    chainId: restaurant.chain_id ?? CANONICAL_MIGRATED_CHAIN_ID,
    personId: input.personId,
    systemRole: input.role,
  });
  await syncEmploymentRelationshipProjection({
    companyId: restaurant.company_id ?? CANONICAL_MIGRATED_COMPANY_ID,
    personId: input.personId,
    restaurantId: input.restaurantId,
    systemRole: input.role,
  });
  await syncRoleScopeProjection({
    personId: input.personId,
    restaurantId: input.restaurantId,
    systemRole: input.role,
    zoneId: normalizedZoneId,
  });
}

export async function getEmploymentRoleSlotConflictCode(
  restaurantId: string,
  role: Extract<EditableEmployeeRole, 'manager' | 'sub_manager'>,
  excludingUserId?: string,
): Promise<'manager_exists' | 'sub_manager_exists' | null> {
  const admin = createSupabaseAdminClient();

  const { data: employmentRows, error: employmentError } = await admin
    .from('employment_relationships')
    .select('person_id')
    .eq('restaurant_id', restaurantId)
    .eq('active_principal', true)
    .eq('is_archived', false);

  if (employmentError) {
    throw new Error(`Failed to load employment projection: ${employmentError.message}`);
  }

  const personIds = ((employmentRows ?? []) as PersonIdRow[])
    .map((row) => row.person_id)
    .filter((personId) => personId !== excludingUserId);

  if (personIds.length === 0) {
    return null;
  }

  const { data: personRows, error: personError } = await admin
    .from('persons')
    .select('person_id')
    .in('person_id', personIds)
    .eq('system_role', role)
    .eq('is_archived', false)
    .limit(1);

  if (personError) {
    throw new Error(`Failed to check employment role slot: ${personError.message}`);
  }

  if (((personRows ?? []) as PersonIdRow[]).length > 0) {
    return role === 'manager' ? 'manager_exists' : 'sub_manager_exists';
  }

  return null;
}

export async function setEmploymentActive(
  personId: string,
  isActive: boolean,
): Promise<void> {
  const admin = createSupabaseAdminClient();

  if (isActive) {
    const seed = await loadEmploymentActivationSeed(personId);

    if (seed?.restaurant_id) {
      await updateEmployment({
        personId,
        restaurantId: seed.restaurant_id,
        role: seed.role as EditableEmploymentSystemRole,
        zoneId: seed.zone_id ?? null,
      });
    } else {
      const { error: personError } = await admin
        .from('persons')
        .update({
          deleted_at: null,
          is_archived: false,
        })
        .eq('person_id', personId);

      if (personError) {
        throw new Error(`Failed to reactivate person projection: ${personError.message}`);
      }
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
