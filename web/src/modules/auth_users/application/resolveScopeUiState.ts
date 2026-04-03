import type { BackendScopeType } from '../domain/backendSession';

export type ScopeUiState = {
  isChainScope: boolean;
  isCompanyScope: boolean;
  isGlobalScope: boolean;
  isRestaurantScope: boolean;
  isSelfScope: boolean;
  isZoneScope: boolean;
};

export function resolveScopeUiState(scopeType: BackendScopeType): ScopeUiState {
  return {
    isChainScope: scopeType === 'chain',
    isCompanyScope: scopeType === 'company',
    isGlobalScope:
      scopeType === 'organization' || scopeType === 'chain' || scopeType === 'company',
    isRestaurantScope: scopeType === 'restaurant',
    isSelfScope: scopeType === 'self',
    isZoneScope: scopeType === 'zone',
  };
}
