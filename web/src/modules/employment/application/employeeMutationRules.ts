import type { SystemRole } from '@/modules/authz';

import { isValidAccountEmail } from '../../auth_users/application/accountCredentialRules';
import type { EditableEmploymentSystemRole } from '../domain/employmentTypes';

export type { EditableEmploymentSystemRole } from '../domain/employmentTypes';

export type EmployeeMutationErrorCode =
  | 'missing'
  | 'invalid_email'
  | 'invalid_role'
  | 'no_effective_restaurant'
  | 'restaurant_mismatch'
  | 'restaurant_invalid'
  | 'manager_exists'
  | 'area_lead_requires_zone'
  | 'area_lead_zone_full'
  | 'duplicate_identity'       // DNI/NIE ya existe en la cadena
  | 'duplicate_employee_code'; // código de empleado duplicado
// 'weak_password' eliminado — ya no hay password en el alta

export type CreateEmployeeDraftInput = {
  email: string;
  fullName: string;
  phone: string;
  identityDocument: string;
  restaurantId: string;
  roleRaw: string;
  zoneId?: string | null;
  // chainId viene del contexto del usuario autenticado, no del form
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
  phone: string;
  identityDocument: string;
  chainId: string;   // inyectado desde el contexto del actor
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

type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errorCode: EmployeeMutationErrorCode };

export function parseEditableEmployeeRole(
  value: string,
): EditableEmploymentSystemRole | null {
  if (value === 'employee' || value === 'area_lead' || value === 'manager') {
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
      ? zoneId?.trim() || null
      : null;

  return { systemRole: role, zoneId: normalizedZoneId };
}

export function validateCreateEmployeeInput(
  input: CreateEmployeeDraftInput,
  chainId: string,
): ValidationResult<CreateEmployeeValidatedInput> {
  const email = input.email.trim();
  const fullName = input.fullName.trim();
  const phone = input.phone.trim();
  const identityDocument = input.identityDocument.trim();
  const restaurantId = input.restaurantId.trim();
  const role = parseEditableEmployeeRole(input.roleRaw);

  if (!email || !fullName || !phone || !identityDocument || !restaurantId) {
    return { ok: false, errorCode: 'missing' };
  }

  if (!isValidAccountEmail(email)) {
    return { ok: false, errorCode: 'invalid_email' };
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
      phone,
      identityDocument,
      chainId,
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

  if (!fullName || !restaurantId || !role) {
    return { ok: false, errorCode: 'missing' };
  }

  if (email && !isValidAccountEmail(email)) {
    return { ok: false, errorCode: 'invalid_email' };
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
    params.actorRole === 'manager' &&
    params.requestedRestaurantId !== params.actorRestaurantId
  ) {
    return 'restaurant_mismatch';
  }

  if (
    params.actorRole === 'manager' &&
    params.requestedRole !== params.targetRole
  ) {
    return 'invalid_role';
  }

  return null;
}

export function mapEmployeeMutationErrorCode(
  error: unknown,
): 'area_lead_zone_full' | 'duplicate_employee_code' | 'duplicate_identity' | 'manager_exists' | null {
  const message = error instanceof Error ? error.message : String(error);

  // Bug fix: faltaba el cierre ) en el if original
  if (
    message === 'manager_exists' ||
    message.includes('ux_profiles_one_manager_per_restaurant')
  ) {
    return 'manager_exists';
  }

  if (message.includes('idx_persons_chain_identity_document_unique')) {
    return 'duplicate_identity';
  }

  if (message.includes('idx_persons_agora_employee_id')) {
    return 'duplicate_employee_code';
  }

  if (message === 'area_lead_zone_full') {
    return 'area_lead_zone_full';
  }

  return null;
}
