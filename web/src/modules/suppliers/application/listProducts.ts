import 'server-only';

import { type ListProductsInput, listProductsInputSchema, type Product } from '../domain/productTypes';
import { assertSupplierAccessible, getModuleContext, getRestaurantScopeOrThrow, getSupplierOrThrow, listAllSupplierIds, listProductsBySupplierIds, listVisibleSuppliersForRestaurant } from './internal';

export async function listProducts(
  input: ListProductsInput = {},
): Promise<Product[]> {
  const params = listProductsInputSchema.parse(input);
  const { admin, requestContext } = await getModuleContext();

  if (params.supplierId) {
    const supplier = await getSupplierOrThrow(admin, params.supplierId);
    await assertSupplierAccessible(admin, requestContext, supplier, params.restaurantId);

    return listProductsBySupplierIds(admin, [supplier.supplier_id], params);
  }

  if ((requestContext.systemRole === 'admin' || requestContext.systemRole === 'office') && !params.restaurantId) {
    return listProductsBySupplierIds(
      admin,
      await listAllSupplierIds(admin, params),
      params,
    );
  }

  const restaurantScope = await getRestaurantScopeOrThrow(
    admin,
    requestContext,
    params.restaurantId,
  );

  const suppliers = await listVisibleSuppliersForRestaurant(admin, restaurantScope, params);
  return listProductsBySupplierIds(
    admin,
    suppliers.map((supplier) => supplier.supplier_id),
    params,
  );
}
