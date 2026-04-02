import {
  jsonError,
  jsonOk,
  parseJsonBody,
  readBooleanSearchParam,
  resolveRouteParams,
} from '@/app/api/_routeUtils';
import {
  createProduct,
  type CreateProductInput,
  createProductInputSchema,
  listProducts,
  listProductsInputSchema,
} from '@/modules/suppliers';

const createProductRouteSchema = createProductInputSchema.omit({ supplierId: true });

type RouteParams = {
  supplierId: string;
};

export async function GET(
  request: Request,
  context: { params: RouteParams | Promise<RouteParams> },
) {
  const params = await resolveRouteParams(context.params);
  const searchParams = new URL(request.url).searchParams;
  const parsed = listProductsInputSchema.safeParse({
    includeArchived: readBooleanSearchParam(searchParams, 'includeArchived'),
    includeInactive: readBooleanSearchParam(searchParams, 'includeInactive'),
    restaurantId: searchParams.get('restaurantId') || undefined,
    search: searchParams.get('search') || undefined,
    supplierId: params.supplierId,
  });

  if (!parsed.success) {
    return jsonError('INVALID_QUERY', 400);
  }

  const products = await listProducts(parsed.data);
  return jsonOk({ products });
}

export async function POST(
  request: Request,
  context: { params: RouteParams | Promise<RouteParams> },
) {
  const params = await resolveRouteParams(context.params);
  const body = await parseJsonBody<Omit<CreateProductInput, 'supplierId'>>(
    request,
    createProductRouteSchema,
  );
  const product = await createProduct({
    ...body,
    supplierId: params.supplierId,
  });
  return jsonOk({ product }, { status: 201 });
}
