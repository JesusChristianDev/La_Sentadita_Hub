import { jsonOk, resolveRouteParams } from '@/app/api/_routeUtils';
import { getDeliveryNoteWithLines } from '@/modules/suppliers';

type RouteParams = {
  deliveryNoteId: string;
};

export async function GET(
  _request: Request,
  context: { params: RouteParams | Promise<RouteParams> },
) {
  const params = await resolveRouteParams(context.params);
  const result = await getDeliveryNoteWithLines(params.deliveryNoteId);
  return jsonOk(result);
}
