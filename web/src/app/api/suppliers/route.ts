import {
  createSupplier,
  type CreateSupplierInput,
  createSupplierInputSchema,
  listSuppliers,
  listSuppliersInputSchema,
} from '@/modules/suppliers';

import { jsonError, jsonOk, parseJsonBody, readBooleanSearchParam } from '../_routeUtils';

const supplierListQuerySchema = listSuppliersInputSchema;

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const parsed = supplierListQuerySchema.safeParse({
    includeArchived: readBooleanSearchParam(searchParams, 'includeArchived'),
    includeInactive: readBooleanSearchParam(searchParams, 'includeInactive'),
    restaurantId: searchParams.get('restaurantId') || undefined,
    scopeId: searchParams.get('scopeId') || undefined,
    scopeType: searchParams.get('scopeType') || undefined,
    search: searchParams.get('search') || undefined,
  });

  if (!parsed.success) {
    return jsonError('INVALID_QUERY', 400);
  }

  const suppliers = await listSuppliers(parsed.data);
  return jsonOk({ suppliers });
}

export async function POST(request: Request) {
  const parsed = await parseJsonBody<CreateSupplierInput>(request, createSupplierInputSchema);
  const supplier = await createSupplier(parsed);
  return jsonOk({ supplier }, { status: 201 });
}
