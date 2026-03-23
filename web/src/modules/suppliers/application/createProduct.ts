import 'server-only';

import { type CreateProductInput, createProductInputSchema, type Product,productSchema } from '../domain/productTypes';
import { assertSupplierActiveForMutation, getModuleContext, getSupplierAuditScope, logAuditOrThrow, requireGlobalBackofficeRole, supplierAuditActions } from './internal';

export async function createProduct(
  input: CreateProductInput,
): Promise<Product> {
  const params = createProductInputSchema.parse(input);
  const { admin, requestContext } = await getModuleContext();

  requireGlobalBackofficeRole(requestContext);

  const supplier = await assertSupplierActiveForMutation(admin, params.supplierId);
  const auditScope = getSupplierAuditScope(supplier);

  const { data, error } = await admin
    .from('products')
    .insert({
      description: params.description ?? null,
      is_active: params.isActive ?? true,
      name: params.name,
      supplier_id: supplier.supplier_id,
      unit: params.unit ?? null,
    })
    .select('*')
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to create product: ${error.message}`);
  }

  if (!data) {
    throw new Error('PRODUCT_CREATE_FAILED');
  }

  const product = productSchema.parse(data);

  await logAuditOrThrow({
    action: supplierAuditActions.createProduct,
    entityId: product.product_id,
    entityType: 'product',
    newValue: {
      name: product.name,
      supplier_id: product.supplier_id,
      unit: product.unit,
    },
    scopeId: auditScope.scopeId,
    scopeType: auditScope.scopeType,
    traceId: requestContext.traceId,
  });

  return product;
}
