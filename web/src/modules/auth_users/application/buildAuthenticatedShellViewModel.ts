import type { FrontendSessionView } from '../domain/frontendSession';

export type AuthenticatedShellViewModel = {
  activeScopeLabel: string;
  contextSelector: {
    canSelectRestaurant: boolean;
    effectiveRestaurantId: string | null;
    restaurants: Array<{
      id: string;
      is_active: boolean;
      name: string;
    }>;
  };
  navigation: FrontendSessionView['capabilities']['navigation'];
};

export function buildAuthenticatedShellViewModel(
  session: FrontendSessionView,
): AuthenticatedShellViewModel {
  return {
    activeScopeLabel: session.activeScope.label,
    contextSelector: {
      canSelectRestaurant: session.capabilities.context.canSelectRestaurant,
      effectiveRestaurantId: session.effectiveRestaurantId,
      restaurants: session.capabilities.context.canSelectRestaurant
        ? session.visibleRestaurants.map((restaurant) => ({
            id: restaurant.id,
            is_active: restaurant.isActive,
            name: restaurant.name,
          }))
        : [],
    },
    navigation: session.capabilities.navigation,
  };
}
