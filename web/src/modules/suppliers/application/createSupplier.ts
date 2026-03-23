import 'server-only';

import { type CreateSupplierInput, createSupplierInputSchema, type Supplier,supplierSchema } from '../domain/supplierTypes';
import { assertSupplierScopeExists, getModuleContext, logAuditOrThrow, requireGlobalBackofficeRole, supplierAuditActions } from './internal';

export async function createSupplier(
  input: CreateSupplierInput,
): Promise<Supplier> {
  const params = createSupplierInputSchema.parse(input);
  const { admin, requestContext } = await getModuleContext();

  requireGlobalBackofficeRole(requestContext);
  await assertSupplierScopeExists(admin, params.scopeType, params.scopeId);

  const { data, error } = await admin
    .from('suppliers')
    .insert({
      contact_email: params.contactEmail ?? null,
      contact_phone: params.contactPhone ?? null,
      is_active: params.isActive ?? true,
      name: params.name,
      scope_id: params.scopeId,
      scope_type: params.scopeType,
      tax_id: params.taxId ?? null,
    })
    .select('*')
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to create supplier: ${error.message}`);
  }

  if (!data) {
    throw new Error('SUPPLIER_CREATE_FAILED');
  }

  const supplier = supplierSchema.parse(data);

  await logAuditOrThrow({
    action: supplierAuditActions.create,
    entityId: supplier.supplier_id,
    entityType: 'supplier',
    newValue: {
      is_active: supplier.is_active,
      name: supplier.name,
      scope_id: supplier.scope_id,
      scope_type: supplier.scope_type,
    },
    scopeId: supplier.scope_id,
    scopeType: supplier.scope_type,
    traceId: requestContext.traceId,
  });

  return supplier;
}
