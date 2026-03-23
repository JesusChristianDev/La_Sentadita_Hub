import 'server-only';

import { type CreateDeliveryNoteInput, createDeliveryNoteInputSchema, deliveryNoteSchema, type DeliveryNoteWithLines,deliveryNoteWithLinesSchema } from '../domain/deliveryNoteTypes';
import { assertCanCreateDeliveryNote, deleteDeliveryNoteOrThrow, ensureSupplierFitsRestaurant, getModuleContext, getRestaurantAuditScope, insertDeliveryNoteLines, logAuditOrThrow, supplierAuditActions } from './internal';

export async function createDeliveryNote(
  input: CreateDeliveryNoteInput,
): Promise<DeliveryNoteWithLines> {
  const params = createDeliveryNoteInputSchema.parse(input);
  const { admin, requestContext } = await getModuleContext();

  const restaurantScope = await assertCanCreateDeliveryNote(
    admin,
    requestContext,
    params.restaurantId,
  );
  const supplier = await ensureSupplierFitsRestaurant(
    admin,
    params.supplierId,
    restaurantScope,
  );

  const { data, error } = await admin
    .from('delivery_notes')
    .insert({
      delivery_date: params.deliveryDate ?? null,
      document_id: params.documentId ?? null,
      document_number: params.documentNumber ?? null,
      ocr_raw_json: params.ocrRawJson ?? null,
      restaurant_id: restaurantScope.restaurantId,
      status: 'uploaded',
      supplier_id: supplier?.supplier_id ?? null,
      tax_amount: params.taxAmount ?? null,
      total_amount: params.totalAmount ?? null,
      uploaded_by: requestContext.personId,
    })
    .select('*')
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to create delivery note: ${error.message}`);
  }

  if (!data) {
    throw new Error('DELIVERY_NOTE_CREATE_FAILED');
  }

  const note = deliveryNoteSchema.parse(data);

  try {
    const lines = await insertDeliveryNoteLines(admin, note.delivery_note_id, params.lines);
    const result = deliveryNoteWithLinesSchema.parse({
      ...note,
      lines,
    });

    const auditScope = getRestaurantAuditScope(restaurantScope.restaurantId);

    await logAuditOrThrow({
      action: supplierAuditActions.uploadDeliveryNote,
      entityId: note.delivery_note_id,
      entityType: 'delivery_note',
      newValue: {
        line_count: lines.length,
        restaurant_id: note.restaurant_id,
        status: note.status,
        supplier_id: note.supplier_id,
      },
      scopeId: auditScope.scopeId,
      scopeType: auditScope.scopeType,
      traceId: requestContext.traceId,
    });

    return result;
  } catch (error) {
    await deleteDeliveryNoteOrThrow(admin, note.delivery_note_id).catch(() => undefined);
    throw error;
  }
}
