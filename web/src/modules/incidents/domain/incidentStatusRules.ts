import type { SystemRole } from '@/shared/authz';

import type { IncidentCategory, IncidentSensitivity, IncidentStatus } from './incidentTypes';

// Valid forward-only status transitions
const ALLOWED_TRANSITIONS: ReadonlyMap<IncidentStatus, ReadonlySet<IncidentStatus>> = new Map([
  ['reported',  new Set(['in_review', 'resolved', 'closed'] as const)],
  ['in_review', new Set(['resolved', 'closed'] as const)],
  ['resolved',  new Set(['closed'] as const)],
  ['closed',    new Set([] as const)],
]);

export function isValidIncidentTransition(
  from: IncidentStatus,
  to: IncidentStatus,
): boolean {
  return ALLOWED_TRANSITIONS.get(from)?.has(to) ?? false;
}

export function assertValidIncidentTransition(
  from: IncidentStatus,
  to: IncidentStatus,
): void {
  if (!isValidIncidentTransition(from, to)) {
    throw new Error(
      `INCIDENT_INVALID_TRANSITION: No se puede pasar de '${from}' a '${to}'.`,
    );
  }
}

// Categories that each role is allowed to create.
// Roles not listed here may only report the "open" categories.
const ROLE_CATEGORY_ALLOWLIST: Readonly<Partial<Record<SystemRole, ReadonlySet<IncidentCategory>>>> = {
  admin:     new Set(['operational','maintenance','hygiene','customer','security','stock','technology','personnel']),
  owner:     new Set(['operational','maintenance','hygiene','customer','security','stock','technology','personnel']),
  office:    new Set(['maintenance','security','technology','personnel','stock']),
  manager:   new Set(['operational','hygiene','customer','stock','maintenance','personnel']),
  area_lead: new Set(['operational','hygiene','customer','stock']),
  employee:  new Set(['operational','hygiene','customer']),
};

export function isRoleAllowedToCreateCategory(
  role: SystemRole,
  category: IncidentCategory,
): boolean {
  return ROLE_CATEGORY_ALLOWLIST[role]?.has(category) ?? false;
}

export function assertRoleAllowedToCreateCategory(
  role: SystemRole,
  category: IncidentCategory,
): void {
  if (!isRoleAllowedToCreateCategory(role, category)) {
    throw new Error(
      `INCIDENT_CATEGORY_FORBIDDEN: El rol '${role}' no puede crear incidencias de categoría '${category}'.`,
    );
  }
}

// Only managers and above can mark incidents as restricted.
const RESTRICTED_ALLOWED_ROLES = new Set<SystemRole>(['admin', 'owner', 'office', 'manager']);

export function isRoleAllowedToMarkRestricted(
  role: SystemRole,
  sensitivity: IncidentSensitivity,
): boolean {
  if (sensitivity !== 'restricted') return true;
  return RESTRICTED_ALLOWED_ROLES.has(role);
}

export function assertRoleAllowedToMarkRestricted(
  role: SystemRole,
  sensitivity: IncidentSensitivity,
): void {
  if (!isRoleAllowedToMarkRestricted(role, sensitivity)) {
    throw new Error(
      `INCIDENT_SENSITIVITY_FORBIDDEN: El rol '${role}' no puede crear incidencias restringidas.`,
    );
  }
}
