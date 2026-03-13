import type { AppRole } from '@/modules/auth_users';

import {
  isStrongAccountPassword,
  isValidAccountEmail,
} from '../../auth_users/application/accountCredentialRules';

export type EditableEmployeeRole = Extract<AppRole, 'employee' | 'manager' | 'sub_manager'>;

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
  | 'area_lead_only_employee';

export type CreateEmployeeDraftInput = {
  email: string;
  fullName: string;
  isAreaLead: boolean;
  password: string;
  restaurantId: string;
  roleRaw: string;
  zoneId?: string | null;
};

export type UpdateEmployeeDraftInput = {
  email?: string;
  fullName: string;
  isAreaLead: boolean;
  password?: string;
  restaurantId: string;
  roleRaw: string;
  zoneId?: string | null;
};

export type CreateEmployeeValidatedInput = {
  email: string;
  fullName: string;
  isAreaLead: boolean;
  password: string;
  restaurantId: string;
  role: EditableEmployeeRole;
  zoneId: string | null;
};

export type UpdateEmployeeValidatedInput = {
  email?: string;
  fullName: string;
  isAreaLead: boolean;
  password?: string;
  restaurantId: string;
  role: EditableEmployeeRole;
  zoneId: string | null;
};

type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errorCode: EmployeeMutationErrorCode };

export function parseEditableEmployeeRole(value: string): EditableEmployeeRole | null {
  if (value === 'employee' || value === 'manager' || value === 'sub_manager') {
    return value;
  }

  return null;
}

export function normalizeEmployeeAssignment(
  role: EditableEmployeeRole,
  zoneId?: string | null,
  isAreaLead = false,
): {
  isAreaLead: boolean;
  zoneId: string | null;
} {
  if (role !== 'employee') {
    return {
      isAreaLead: false,
      zoneId: null,
    };
  }

  return {
    isAreaLead,
    zoneId: zoneId?.trim() ? zoneId.trim() : null,
  };
}

export function buildEmployeeProfilePayload(params: {
  fullName: string;
  isAreaLead?: boolean;
  mustChangePassword?: boolean;
  restaurantId: string;
  role: EditableEmployeeRole;
  zoneId?: string | null;
}) {
  const assignment = normalizeEmployeeAssignment(
    params.role,
    params.zoneId,
    params.isAreaLead ?? false,
  );

  return {
    full_name: params.fullName,
    is_area_lead: assignment.isAreaLead,
    ...(params.mustChangePassword !== undefined
      ? { must_change_password: params.mustChangePassword }
      : {}),
    restaurant_id: params.restaurantId,
    role: params.role,
    zone_id: assignment.zoneId,
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

  if (!role) {
    return { ok: false, errorCode: 'invalid_role' };
  }

  if (input.isAreaLead && role !== 'employee') {
    return { ok: false, errorCode: 'area_lead_only_employee' };
  }

  const assignment = normalizeEmployeeAssignment(role, input.zoneId, input.isAreaLead);

  return {
    ok: true,
    value: {
      email,
      fullName,
      isAreaLead: assignment.isAreaLead,
      password,
      restaurantId,
      role,
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

  if (!fullName || !restaurantId || !role) {
    return { ok: false, errorCode: 'missing' };
  }

  if (email && !isValidAccountEmail(email)) {
    return { ok: false, errorCode: 'invalid_email' };
  }

  if (password && !isStrongAccountPassword(password)) {
    return { ok: false, errorCode: 'weak_password' };
  }

  if (input.isAreaLead && role !== 'employee') {
    return { ok: false, errorCode: 'area_lead_only_employee' };
  }

  const assignment = normalizeEmployeeAssignment(role, input.zoneId, input.isAreaLead);

  return {
    ok: true,
    value: {
      ...(email ? { email } : {}),
      fullName,
      isAreaLead: assignment.isAreaLead,
      ...(password ? { password } : {}),
      restaurantId,
      role,
      zoneId: assignment.zoneId,
    },
  };
}

export function validateScopedEmployeeManagement(params: {
  actorRestaurantId: string | null;
  actorRole: AppRole;
  requestedRestaurantId: string;
  requestedRole: EditableEmployeeRole;
  targetRole: string;
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
): 'manager_exists' | 'sub_manager_exists' | null {
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

  return null;
}
