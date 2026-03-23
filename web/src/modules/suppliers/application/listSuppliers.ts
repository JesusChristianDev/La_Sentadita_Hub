import 'server-only';

import { type ListSuppliersInput, listSuppliersInputSchema, type Supplier,supplierSchema } from '../domain/supplierTypes';
import { getModuleContext, getRestaurantScopeOrThrow, listVisibleSuppliersForRestaurant } from './internal';

export async function listSuppliers(
  input: ListSuppliersInput = {},
): Promise<Supplier[]> {
  const params = listSuppliersInputSchema.parse(input);
  const { admin, requestContext } = await getModuleContext();

  if (requestContext.systemRole === 'admin' || requestContext.systemRole === 'office') {
    if (params.restaurantId && !params.scopeId && !params.scopeType) {
      const restaurantScope = await getRestaurantScopeOrThrow(
        admin,
        requestContext,
        params.restaurantId,
      );

      return listVisibleSuppliersForRestaurant(admin, restaurantScope, params);
    }

    let query = admin.from('suppliers').select('*').order('name', { ascending: true });

    if (!params.includeArchived) query = query.eq('is_archived', false);
    if (!params.includeInactive) query = query.eq('is_active', true);
    if (params.scopeType) query = query.eq('scope_type', params.scopeType);
    if (params.scopeId) query = query.eq('scope_id', params.scopeId);
    if (params.search) query = query.ilike('name', `%${params.search}%`);

    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to list suppliers: ${error.message}`);
    }

    return (data ?? []).map((row) => supplierSchema.parse(row));
  }

  const restaurantScope = await getRestaurantScopeOrThrow(
    admin,
    requestContext,
    params.restaurantId,
  );

  return listVisibleSuppliersForRestaurant(admin, restaurantScope, params);
}
