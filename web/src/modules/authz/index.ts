export type { AuthzAction, AuthzResource } from './application/aclRules';
export { assertCan, can, isAreaLead, toRequestContext } from './application/can';
export type {
  ActiveScope,
  ActorLike,
  RequestContext,
  UserContextLike,
} from './application/requestContext';
export {
  buildRequestContextFromProfile,
  buildRequestContextFromUserContext,
  deriveActiveScopes,
  deriveScopeType,
  deriveSystemRole,
  isRequestContext,
} from './application/requestContext';
export {
  assertRestaurantAccess,
  assertRestaurantManagement,
  assertSelfOrManagement,
  assertZoneAccess,
  canAccessRestaurant,
  canAccessZone,
  canManageRestaurant,
  isAreaLeadSystemRole,
  isGlobalSystemRole,
  isManagementSystemRole,
  isRestaurantManagementRole,
  isSelfScope,
} from './application/scopeGuards';
export type { CanonicalScopeType, CanonicalSystemRole } from './domain/canonicalCatalog';
export {
  CANONICAL_SCOPE_TYPES,
  CANONICAL_SYSTEM_ROLES,
  isCanonicalScopeType,
  isCanonicalSystemRole,
} from './domain/canonicalCatalog';
export type { ResponsibilityLevel } from './domain/responsibilityLevel';
export { deriveResponsibilityLevel } from './domain/responsibilityLevel';
export type { ScopeType, SystemRole } from './domain/systemRoles';
export { coerceSystemRole, isSystemRole, SYSTEM_ROLES } from './domain/systemRoles';
