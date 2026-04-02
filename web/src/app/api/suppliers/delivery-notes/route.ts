import {
  jsonOk,
  parseJsonBody,
} from '@/app/api/_routeUtils';
import {
  createDeliveryNote,
  type CreateDeliveryNoteInput,
  createDeliveryNoteInputSchema,
  listDeliveryNotes,
} from '@/modules/suppliers';

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const restaurantId = searchParams.get('restaurantId') || undefined;
  const notes = await listDeliveryNotes({ restaurantId });
  return jsonOk({ deliveryNotes: notes });
}

export async function POST(request: Request) {
  const body = await parseJsonBody<CreateDeliveryNoteInput>(request, createDeliveryNoteInputSchema);
  const deliveryNote = await createDeliveryNote(body);
  return jsonOk({ deliveryNote }, { status: 201 });
}
