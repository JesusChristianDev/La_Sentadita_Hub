import { jsonOk, resolveRouteParams } from '@/app/api/_routeUtils';
import { reviewDeliveryNote } from '@/modules/suppliers';

type RouteParams = {
  deliveryNoteId: string;
};

export async function POST(
  _request: Request,
  context: { params: RouteParams | Promise<RouteParams> },
) {
  const params = await resolveRouteParams(context.params);
  const deliveryNote = await reviewDeliveryNote({ deliveryNoteId: params.deliveryNoteId });
  return jsonOk({ deliveryNote });
}
