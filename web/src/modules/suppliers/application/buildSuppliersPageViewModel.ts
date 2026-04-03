import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { buildFrontendSessionView, type CurrentSession } from '@/modules/auth_users';
import type { FrontendVisibleRestaurant } from '@/modules/auth_users/domain/frontendSession';

import type { DeliveryNote } from '../domain/deliveryNoteTypes';
import type { Product } from '../domain/productTypes';
import type { Supplier } from '../domain/supplierTypes';
import { listDeliveryNotes } from './listDeliveryNotes';
import { listProducts } from './listProducts';
import { listSuppliers } from './listSuppliers';

type ScopeChoice = {
  label: string;
  scopeId: string;
  scopeType: 'organization' | 'restaurant';
};

type RestaurantChoice = {
  id: string;
  name: string;
};

export type SuppliersPageViewModel = {
  activeScopeLabel: string;
  canCreateDeliveryNote: boolean;
  canCreateProduct: boolean;
  canCreateSupplier: boolean;
  canFinalizeDeliveryNote: boolean;
  canReviewDeliveryNote: boolean;
  currentRestaurantId: string | null;
  currentRestaurantName: string | null;
  currentUserId: string;
  deliveryNotes: DeliveryNote[];
  mode: 'context_required' | 'forbidden' | 'global_overview' | 'restaurant_workspace';
  products: Product[];
  restaurantChoices: RestaurantChoice[];
  scopeChoices: ScopeChoice[];
  suppliers: Supplier[];
};

async function resolveOrganizationScopeId(
  session: CurrentSession,
  visibleRestaurants: RestaurantChoice[],
): Promise<string | null> {
  const activeScope = session.backendSession.activeScope;
  if (activeScope.scopeType === 'organization' && activeScope.scopeId) {
    return activeScope.scopeId;
  }

  const fallbackRestaurantId =
    session.backendSession.effectiveRestaurantId ?? visibleRestaurants[0]?.id ?? null;
  if (!fallbackRestaurantId) {
    return null;
  }

  const fallbackRestaurant = session.backendSession.visibleRestaurants.find(
    (restaurant) => restaurant.id === fallbackRestaurantId,
  );
  if (!fallbackRestaurant?.companyId) {
    return null;
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('companies')
    .select('organization_id')
    .eq('company_id', fallbackRestaurant.companyId)
    .maybeSingle<{ organization_id: string | null }>();

  if (error || !data?.organization_id) {
    return null;
  }

  return data.organization_id;
}

function buildRestaurantChoices(
  visibleRestaurants: FrontendVisibleRestaurant[],
): RestaurantChoice[] {
  return visibleRestaurants
    .filter((restaurant) => restaurant.isActive)
    .map((restaurant) => ({
      id: restaurant.id,
      name: restaurant.name,
    }));
}

function buildScopeChoices(
  organizationScopeId: string | null,
  restaurantChoices: RestaurantChoice[],
): ScopeChoice[] {
  return [
    ...(organizationScopeId
      ? [
          {
            label: 'Organizacion',
            scopeId: organizationScopeId,
            scopeType: 'organization' as const,
          },
        ]
      : []),
    ...restaurantChoices.map((restaurant) => ({
      label: restaurant.name,
      scopeId: restaurant.id,
      scopeType: 'restaurant' as const,
    })),
  ];
}

export async function buildSuppliersPageViewModel(
  session: CurrentSession,
): Promise<SuppliersPageViewModel> {
  const frontendSession = buildFrontendSessionView(session);
  const currentRestaurantId = frontendSession.effectiveRestaurantId;
  const isBackofficeRole =
    session.requestContext.systemRole === 'admin' ||
    session.requestContext.systemRole === 'office';

  if (!frontendSession.capabilities.procurement.view) {
    return {
      activeScopeLabel: frontendSession.activeScope.label,
      canCreateDeliveryNote: false,
      canCreateProduct: false,
      canCreateSupplier: false,
      canFinalizeDeliveryNote: false,
      canReviewDeliveryNote: false,
      currentRestaurantId: null,
      currentRestaurantName: null,
      currentUserId: session.userId,
      deliveryNotes: [],
      mode: 'forbidden',
      products: [],
      restaurantChoices: [],
      scopeChoices: [],
      suppliers: [],
    };
  }

  const restaurantChoices = buildRestaurantChoices(frontendSession.visibleRestaurants);

  if (!currentRestaurantId && !isBackofficeRole) {
    return {
      activeScopeLabel: frontendSession.activeScope.label,
      canCreateDeliveryNote: restaurantChoices.length > 0,
      canCreateProduct: false,
      canCreateSupplier: false,
      canFinalizeDeliveryNote: false,
      canReviewDeliveryNote: false,
      currentRestaurantId: null,
      currentRestaurantName: null,
      currentUserId: session.userId,
      deliveryNotes: [],
      mode: 'context_required',
      products: [],
      restaurantChoices,
      scopeChoices: [],
      suppliers: [],
    };
  }

  const organizationScopeId = await resolveOrganizationScopeId(session, restaurantChoices);
  const scopeChoices = buildScopeChoices(organizationScopeId, restaurantChoices);
  const queryRestaurantId = currentRestaurantId ?? undefined;

  const [suppliers, products, deliveryNotes] = await Promise.all([
    listSuppliers(queryRestaurantId ? { restaurantId: queryRestaurantId } : {}),
    listProducts(queryRestaurantId ? { restaurantId: queryRestaurantId } : {}),
    queryRestaurantId
      ? listDeliveryNotes({ restaurantId: queryRestaurantId })
      : Promise.resolve([] as DeliveryNote[]),
  ]);

  return {
    activeScopeLabel: frontendSession.activeScope.label,
    canCreateDeliveryNote: restaurantChoices.length > 0,
    canCreateProduct: isBackofficeRole && suppliers.length > 0,
    canCreateSupplier: isBackofficeRole && scopeChoices.length > 0,
    canFinalizeDeliveryNote: isBackofficeRole,
    canReviewDeliveryNote:
      isBackofficeRole || session.requestContext.systemRole === 'manager',
    currentRestaurantId,
    currentRestaurantName:
      frontendSession.visibleRestaurants.find((restaurant) => restaurant.id === currentRestaurantId)
        ?.name ?? null,
    currentUserId: session.userId,
    deliveryNotes,
    mode: currentRestaurantId ? 'restaurant_workspace' : 'global_overview',
    products,
    restaurantChoices,
    scopeChoices,
    suppliers,
  };
}
