import 'server-only';

import { type DeliveryNote, deliveryNoteSchema, type RejectDeliveryNoteInput,rejectDeliveryNoteInputSchema } from '../domain/deliveryNoteTypes';
import { assertCanFinalizeDeliveryNote, assertFinalizableStatus, getDeliveryNoteOrThrow, getModuleContext, getRestaurantAuditScope, logAuditOrThrow, maybeMarkOfficeReviewingBeforeFinalize, supplierAuditActions } from './internal';

export async function rejectDeliveryNote(
  input: RejectDeliveryNoteInput,
): Promise<DeliveryNote> {
  const params = rejectDeliveryNoteInputSchema.parse(input);
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
      confirmed_at: null,
      office_reviewed_at: new Date().toISOString(),
      rejection_reason: params.rejectionReason,
      reviewed_by_office: requestContext.personId,
      status: 'rejected',
    })
    .eq('delivery_note_id', current.delivery_note_id)
    .select('*')
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to reject delivery note: ${error.message}`);
  }

  if (!data) {
    throw new Error('DELIVERY_NOTE_REJECT_FAILED');
  }

  const updated = deliveryNoteSchema.parse(data);
  const auditScope = getRestaurantAuditScope(updated.restaurant_id);

  await logAuditOrThrow({
    action: supplierAuditActions.rejectDeliveryNote,
    entityId: updated.delivery_note_id,
    entityType: 'delivery_note',
    newValue: {
      rejection_reason: updated.rejection_reason,
      reviewed_by_office: updated.reviewed_by_office,
      status: updated.status,
    },
    previousValue: {
      rejection_reason: current.rejection_reason,
      status: current.status,
    },
    reason: params.rejectionReason,
    scopeId: auditScope.scopeId,
    scopeType: auditScope.scopeType,
    traceId: requestContext.traceId,
  });

  return updated;
}
