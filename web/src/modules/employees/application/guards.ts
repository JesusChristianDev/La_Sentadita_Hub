import { redirect } from 'next/navigation';

import { can, deriveSystemRole, type LegacyActorLike, type SystemRole, toRequestContext } from '@/modules/authz';
import type { EditableEmploymentSystemRole } from '@/modules/employment';
import {
  getLegacyEmploymentRoleSlotConflictCode,
  hasLegacyActiveAreaLead,
} from '@/shared/db/employment';
import { loadLegacyPersonProfileById } from '@/shared/db/persons';
import { employeesPathWithError } from '@/shared/feedbackMessages';

type EmployeeRoleSlotConflictCode = 'manager_exists' | 'sub_manager_exists';

function mapSystemRoleToEditableEmployeeRole(
  systemRole: SystemRole,
): EditableEmploymentSystemRole | null {
  if (systemRole === 'area_lead' || systemRole === 'employee') {
    return systemRole;
  }

  if (systemRole === 'manager' || systemRole === 'sub_manager') {
    return systemRole;
  }

  return null;
}

// --------------- Role checks ---------------

export function canCreate(actor: LegacyActorLike): boolean {
  return can(actor, 'employees.create');
}

export function canManageUsers(actor: LegacyActorLike): boolean {
  return can(actor, 'employees.manage');
}

// --------------- Parsing helpers ---------------

// --------------- Authorization guards ---------------

export async function loadTarget(
  userId: string,
): Promise<{
  editableRole: EditableEmploymentSystemRole | null;
  restaurant_id: string | null;
  systemRole: SystemRole;
}> {
  const profile = await loadLegacyPersonProfileById(userId);
  const systemRole = deriveSystemRole(profile);

  return {
    editableRole: mapSystemRoleToEditableEmployeeRole(systemRole),
    restaurant_id: profile.restaurant_id,
    systemRole,
  };
}

export async function assertCanManageTarget(
  actor: LegacyActorLike,
  userId: string,
): Promise<{
  editableRole: EditableEmploymentSystemRole | null;
  restaurant_id: string | null;
  systemRole: SystemRole;
}> {
  const target = await loadTarget(userId);
  const actorContext = toRequestContext(actor);

  if (
    target.systemRole === 'admin' ||
    target.systemRole === 'office' ||
    target.systemRole === 'chain_owner'
  ) {
    redirect(employeesPathWithError('global_user'));
  }

  if (
    can(actorContext, 'employees.manage_target', {
      targetRestaurantId: target.restaurant_id,
      targetSystemRole: target.systemRole,
    })
  ) {
    return target;
  }

  if (target.systemRole === 'manager') {
    redirect(employeesPathWithError('manager_protected'));
  }

  redirect(employeesPathWithError('restaurant_mismatch'));
}

// --------------- Slot validation ---------------

export async function getRoleSlotConflictCode(
  restaurantId: string,
  role: 'manager' | 'sub_manager',
  excludingUserId?: string,
): Promise<EmployeeRoleSlotConflictCode | null> {
  return getLegacyEmploymentRoleSlotConflictCode(
    restaurantId,
    role,
    excludingUserId,
  );
}

export async function hasActiveAreaLead(userId: string): Promise<boolean> {
  return hasLegacyActiveAreaLead(userId);
}
