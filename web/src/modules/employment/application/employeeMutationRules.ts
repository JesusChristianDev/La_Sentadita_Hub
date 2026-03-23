import type { SystemRole } from '@/modules/authz';

import {
  isStrongAccountPassword,
  isValidAccountEmail,
} from '../../auth_users/application/accountCredentialRules';
import type {
  EditableEmploymentSystemRole,
} from '../domain/employmentTypes';

export type {
  EditableEmploymentSystemRole,
} from '../domain/employmentTypes';

export type EmployeeMutationErrorCode =
  | 'missing'
  | 'invalid_email'
  | 'weak_password'
  | 'invalid_role'
  | 'no_effective_restaurant'
  | 'restaurant_mismatch'
  | 'restaurant_invalid'
  | 'manager_exists'
  | 'sub_manager_exists'
  | 'area_lead_requires_zone'
  | 'area_lead_zone_full';

export type CreateEmployeeDraftInput = {
  email: string;
  fullName: string;
  password: string;
  restaurantId: string;
  roleRaw: string;
  zoneId?: string | null;
};

export type UpdateEmployeeDraftInput = {
  email?: string;
  fullName: string;
  password?: string;
  restaurantId: string;
  roleRaw: string;
  zoneId?: string | null;
};

export type CreateEmployeeValidatedInput = {
  email: string;
  fullName: string;
  password: string;
  restaurantId: string;
  role: EditableEmploymentSystemRole;
  zoneId: string | null;
};

export type UpdateEmployeeValidatedInput = {
  email?: string;
  fullName: string;
  password?: string;
  restaurantId: string;
  role: EditableEmploymentSystemRole;
  zoneId: string | null;
};

type ValidationResult<T> = | { ok: true; value: T } | { ok: false; errorCode: EmployeeMutationErrorCode };

export function parseEditableEmployeeRole(
  value: string,
): EditableEmploymentSystemRole | null {
  if (
    value === 'employee' ||
    value === 'area_lead' ||
    value === 'manager' ||
    value === 'sub_manager'
  ) {
    return value;
  }

  return null;
}

export function normalizeEmployeeAssignment(
  role: EditableEmploymentSystemRole,
  zoneId?: string | null,
): {
  systemRole: EditableEmploymentSystemRole;
  zoneId: string | null;
} {
  const normalizedZoneId =
    role === 'employee' || role === 'area_lead'
      ? (zoneId?.trim() ? zoneId.trim() : null)
      : null;

  return {
    systemRole: role,
    zoneId: normalizedZoneId,
  };
}

export function validateCreateEmployeeInput(
  input: CreateEmployeeDraftInput,
): ValidationResult<CreateEmployeeValidatedInput> {
  const email = input.email.trim();
  const fullName = input.fullName.trim();
  const password = input.password;
  const restaurantId = input.restaurantId.trim();
  const role = parseEditableEmployeeRole(input.roleRaw);

  if (!email || !fullName || !password || !restaurantId) {
    return { ok: false, errorCode: 'missing' };
  }

  if (!isValidAccountEmail(email)) {
    return { ok: false, errorCode: 'invalid_email' };
  }

  if (!isStrongAccountPassword(password)) {
    return { ok: false, errorCode: 'weak_password' };
  }

  if (!role) return { ok: false, errorCode: 'invalid_role' };

  const assignment = normalizeEmployeeAssignment(role, input.zoneId);

  if (assignment.systemRole === 'area_lead' && !assignment.zoneId) {
    return { ok: false, errorCode: 'area_lead_requires_zone' };
  }

  return {
    ok: true,
    value: {
      email,
      fullName,
      password,
      restaurantId,
      role: assignment.systemRole,
      zoneId: assignment.zoneId,
    },
  };
}

export function validateUpdateEmployeeInput(
  input: UpdateEmployeeDraftInput,
): ValidationResult<UpdateEmployeeValidatedInput> {
  const fullName = input.fullName.trim();
  const restaurantId = input.restaurantId.trim();
  const role = parseEditableEmployeeRole(input.roleRaw);
  const email = input.email?.trim() || undefined;
  const password = input.password || undefined;

  if (!fullName || !restaurantId || !role) return { ok: false, errorCode: 'missing' };

  if (email && !isValidAccountEmail(email)) {
    return { ok: false, errorCode: 'invalid_email' };
  }

  if (password && !isStrongAccountPassword(password)) {
    return { ok: false, errorCode: 'weak_password' };
  }

  const assignment = normalizeEmployeeAssignment(role, input.zoneId);

  if (assignment.systemRole === 'area_lead' && !assignment.zoneId) {
    return { ok: false, errorCode: 'area_lead_requires_zone' };
  }

  return {
    ok: true,
    value: {
      ...(email ? { email } : {}),
      fullName,
      ...(password ? { password } : {}),
      restaurantId,
      role: assignment.systemRole,
      zoneId: assignment.zoneId,
    },
  };
}

export function validateScopedEmployeeManagement(params: {
  actorRestaurantId: string | null;
  actorRole: SystemRole;
  requestedRestaurantId: string;
  requestedRole: EditableEmploymentSystemRole;
  targetRole: EditableEmploymentSystemRole;
}): EmployeeMutationErrorCode | null {
  if (
    (params.actorRole === 'manager' || params.actorRole === 'sub_manager') &&
    params.requestedRestaurantId !== params.actorRestaurantId
  ) {
    return 'restaurant_mismatch';
  }

  if (
    (params.actorRole === 'manager' || params.actorRole === 'sub_manager') &&
    params.requestedRole !== params.targetRole
  ) {
    return 'invalid_role';
  }

  return null;
}

export function mapEmployeeMutationErrorCode(
  error: unknown,
): 'area_lead_zone_full' | 'manager_exists' | 'sub_manager_exists' | null {
  const message = error instanceof Error ? error.message : String(error);

  if (
    message === 'manager_exists' ||
    message.includes('ux_profiles_one_manager_per_restaurant')
  ) {
    return 'manager_exists';
  }

  if (
    message === 'sub_manager_exists' ||
    message.includes('ux_profiles_one_sub_manager_per_restaurant')
  ) {
    return 'sub_manager_exists';
  }

  if (message === 'area_lead_zone_full') {
    return 'area_lead_zone_full';
  }

  return null;
}
