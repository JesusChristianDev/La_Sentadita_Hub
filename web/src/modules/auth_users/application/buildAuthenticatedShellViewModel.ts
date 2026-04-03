import type { FrontendSessionView } from '../domain/frontendSession';

export type AuthenticatedShellViewModel = {
  activeScopeLabel: string;
  scopeSelector: {
    activeScopeId: string | null;
    activeScopeType: FrontendSessionView['activeScope']['scopeType'];
    canSelectScope: boolean;
    scopes: Array<{
      authorityTier: string | null;
      isDerived: boolean;
      label: string;
      scopeId: string | null;
      scopeType: FrontendSessionView['activeScope']['scopeType'];
    }>;
  };
  navigation: FrontendSessionView['capabilities']['navigation'];
};

export function buildAuthenticatedShellViewModel(
  session: FrontendSessionView,
): AuthenticatedShellViewModel {
  return {
    activeScopeLabel: session.activeScope.label,
    scopeSelector: {
      activeScopeId: session.activeScope.scopeId,
      activeScopeType: session.activeScope.scopeType,
      canSelectScope: session.capabilities.context.canSelectScope,
      scopes: session.availableScopes,
    },
    navigation: session.capabilities.navigation,
  };
}
