export {
  clearStoredActiveScope,
  persistActiveScope,
  readLegacyActiveRestaurantId,
  readStoredActiveScope,
} from './application/activeScopeCookies';
export {
  type AuthenticatedShellViewModel,
  buildAuthenticatedShellViewModel,
} from './application/buildAuthenticatedShellViewModel';
export {
  buildFrontendSessionView,
} from './application/buildFrontendSessionView';
export {
  buildMePageViewModel,
  type MePageViewModel,
} from './application/buildMePageViewModel';
export type { CurrentSession, UserContext } from './application/getCurrentUserContext';
export { getCurrentUserContext } from './application/getCurrentUserContext';
export { getEffectiveRestaurantId } from './application/getEffectiveRestaurantId';
export type {
  BackendActiveScope,
  BackendAvailableScope,
  BackendEmployment,
  BackendPerson,
  BackendRoleScopeAssignment,
  BackendScopeType,
  BackendSession,
  BackendVisibleRestaurant,
  BackendZoneAssignment,
} from './domain/backendSession';
export type {
  FrontendCapabilities,
  FrontendPageMode,
  FrontendScopeOption,
  FrontendSessionView,
  FrontendVisibleRestaurant,
  RequestsPageMode,
  RestaurantScopedModuleMode,
} from './domain/frontendSession';
export {
  loadBackendSession,
  projectPersonProfileFromBackendSession,
} from './infrastructure/backendSessionRepository';
export type { RequestContext } from '@/shared/authz';
