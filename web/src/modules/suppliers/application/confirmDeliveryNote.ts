import 'server-only';

import { type ConfirmDeliveryNoteInput, confirmDeliveryNoteInputSchema, type DeliveryNote,deliveryNoteSchema } from '../domain/deliveryNoteTypes';
import { assertCanFinalizeDeliveryNote, assertFinalizableStatus, getDeliveryNoteOrThrow, getModuleContext, getRestaurantAuditScope, logAuditOrThrow, maybeMarkOfficeReviewingBeforeFinalize, supplierAuditActions } from './internal';

export async function confirmDeliveryNote(
  input: ConfirmDeliveryNoteInput,
): Promise<DeliveryNote> {
  const params = confirmDeliveryNoteInputSchema.parse(input);
  const { admin, requestContext } = await getModuleContext();

  assertCanFinalizeDeliveryNote(requestContext);

  const current = await getDeliveryNoteOrThrow(admin, params.deliveryNoteId);
  assertFinalizableStatus(current.status);

  await maybeMarkOfficeReviewingBeforeFinalize(
    admin,
    current,
    requestContext.personId,
  );

  const { data, error } = await admin
    .from('delivery_notes')
    .update({
      confirmed_at: new Date().toISOString(),
      office_reviewed_at: new Date().toISOString(),
      rejection_reason: null,
      reviewed_by_office: requestContext.personId,
      status: 'confirmed',
    })
    .eq('delivery_note_id', current.delivery_note_id)
    .select('*')
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to confirm delivery note: ${error.message}`);
  }

  if (!data) {
    throw new Error('DELIVERY_NOTE_CONFIRM_FAILED');
  }

  const updated = deliveryNoteSchema.parse(data);
  const auditScope = getRestaurantAuditScope(updated.restaurant_id);

  await logAuditOrThrow({
    action: supplierAuditActions.confirmDeliveryNote,
    entityId: updated.delivery_note_id,
    entityType: 'delivery_note',
    newValue: {
      confirmed_at: updated.confirmed_at,
      reviewed_by_office: updated.reviewed_by_office,
      status: updated.status,
    },
    previousValue: {
      status: current.status,
    },
    scopeId: auditScope.scopeId,
    scopeType: auditScope.scopeType,
    traceId: requestContext.traceId,
  });

  return updated;
}
