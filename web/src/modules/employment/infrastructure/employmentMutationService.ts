import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import {
  type EditableEmployeeRole,
  type EditableEmploymentSystemRole,
} from '@/modules/employment/domain/employmentTypes';
import {
  type RestaurantAssignmentRow,
  type RoleScopeRow,
  type ZoneAssignmentRow,
  isCurrentTemporalRow,
  loadCompanyByRestaurantId,
  loadCurrentEmploymentForPerson,
  loadCurrentRestaurantAssignment,
  loadCurrentRoleScopesForPerson,
  loadCurrentZoneAssignment,
  loadLatestEmploymentForPerson,
  loadRestaurantAssignmentsByEmploymentIds,
  loadZoneAssignmentsByEmploymentIds,
  normalizeEditableEmploymentRole,
  previousIsoDate,
  todayIsoDate,
} from './employmentRepository';
import {
  getAreaLeadZoneConflictCode,
  getEmploymentRoleSlotConflictCode,
} from './employmentProjectionService';

const BAN_100_YEARS = '876600h';

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
          activeRestaurantAssignments.map((row: RestaurantAssignmentRow) => row.assignment_id),
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
          activeZoneAssignments.map((row: ZoneAssignmentRow) => row.assignment_id),
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
          currentScopes.map((row: RoleScopeRow) => row.assignment_id),
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
