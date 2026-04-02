import { z } from 'zod';

import { jsonOk, parseJsonBody, resolveRouteParams } from '@/app/api/_routeUtils';
import { rejectDeliveryNote } from '@/modules/suppliers';

const rejectSchema = z.object({
  rejectionReason: z.string().trim().min(1).max(600),
});

type RouteParams = {
  deliveryNoteId: string;
};

export async function POST(
  request: Request,
  context: { params: RouteParams | Promise<RouteParams> },
) {
  const params = await resolveRouteParams(context.params);
  const body = await parseJsonBody<{ rejectionReason: string }>(request, rejectSchema);
  const deliveryNote = await rejectDeliveryNote({
    deliveryNoteId: params.deliveryNoteId,
    rejectionReason: body.rejectionReason,
  });
  return jsonOk({ deliveryNote });
}
