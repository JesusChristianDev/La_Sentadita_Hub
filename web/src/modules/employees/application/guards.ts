import { redirect } from 'next/navigation';

import { type ActorLike, can, deriveSystemRole, type SystemRole, toRequestContext } from '@/modules/authz';
import type { EditableEmploymentSystemRole } from '@/modules/employment';
import {
  getEmploymentRoleSlotConflictCode,
  hasActiveAreaLead as hasActiveAreaLeadInEmployment,
} from '@/shared/db/employment';
import { loadPersonProfileById } from '@/shared/db/persons';
import { employeesPathWithError } from '@/shared/feedbackMessages';

type EmployeeRoleSlotConflictCode = 'manager_exists' | 'sub_manager_exists';

function mapSystemRoleToEditableEmployeeRole(
  systemRole: SystemRole,
): EditableEmploymentSystemRole | null {
  if (systemRole === 'area_lead' || systemRole === 'employee') {
    return systemRole;
  }

  if (systemRole === 'manager') {
    return systemRole;
  }

  return null;
}

// --------------- Role checks ---------------

export function canCreate(actor: ActorLike): boolean {
  return can(actor, 'employees.create');
}

export function canManageUsers(actor: ActorLike): boolean {
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
  const profile = await loadPersonProfileById(userId);
  const systemRole = deriveSystemRole(profile);

  return {
    editableRole: mapSystemRoleToEditableEmployeeRole(systemRole),
    restaurant_id: profile.restaurant_id,
    systemRole,
  };
}

export async function assertCanManageTarget(
  actor: ActorLike,
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
    target.systemRole === 'owner'
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
  return getEmploymentRoleSlotConflictCode(
    restaurantId,
    role,
    excludingUserId,
  );
}

export async function hasActiveAreaLead(userId: string): Promise<boolean> {
  return hasActiveAreaLeadInEmployment(userId);
}
