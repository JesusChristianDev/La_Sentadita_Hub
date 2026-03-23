export type { AuthzAction, AuthzResource } from './application/aclRules';
export { assertCan, can, isAreaLead, toRequestContext } from './application/can';
export type {
  ActiveScope,
  LegacyActorLike,
  LegacyUserContextLike,
  RequestContext,
} from './application/requestContext';
export {
  buildRequestContextFromLegacyProfile,
  buildRequestContextFromLegacyUserContext,
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
export type { ResponsibilityLevel } from './domain/responsibilityLevel';
export { deriveResponsibilityLevel } from './domain/responsibilityLevel';
export type { ScopeType, SystemRole } from './domain/systemRoles';
export { isSystemRole,SYSTEM_ROLES } from './domain/systemRoles';
