import 'server-only';

import { type DeliveryNote, deliveryNoteSchema, type ReviewDeliveryNoteInput,reviewDeliveryNoteInputSchema } from '../domain/deliveryNoteTypes';
import { assertCanReviewDeliveryNote, assertReviewableStatus, getDeliveryNoteOrThrow, getModuleContext, getRestaurantAuditScope, logAuditOrThrow, supplierAuditActions } from './internal';

export async function reviewDeliveryNote(
  input: ReviewDeliveryNoteInput,
): Promise<DeliveryNote> {
  const params = reviewDeliveryNoteInputSchema.parse(input);
  const { admin, requestContext } = await getModuleContext();

  const current = await getDeliveryNoteOrThrow(admin, params.deliveryNoteId);
  assertCanReviewDeliveryNote(requestContext, current);
  assertReviewableStatus(current.status);

  const { data, error } = await admin
    .from('delivery_notes')
    .update({
      employee_reviewed_at: new Date().toISOString(),
      reviewed_by_employee: requestContext.personId,
      status: 'employee_reviewed',
    })
    .eq('delivery_note_id', current.delivery_note_id)
    .select('*')
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to review delivery note: ${error.message}`);
  }

  if (!data) {
    throw new Error('DELIVERY_NOTE_REVIEW_FAILED');
  }

  const updated = deliveryNoteSchema.parse(data);
  const auditScope = getRestaurantAuditScope(updated.restaurant_id);

  await logAuditOrThrow({
    action: supplierAuditActions.reviewDeliveryNote,
    entityId: updated.delivery_note_id,
    entityType: 'delivery_note',
    newValue: {
      reviewed_by_employee: updated.reviewed_by_employee,
      status: updated.status,
    },
    previousValue: {
      reviewed_by_employee: current.reviewed_by_employee,
      status: current.status,
    },
    scopeId: auditScope.scopeId,
    scopeType: auditScope.scopeType,
    traceId: requestContext.traceId,
  });

  return updated;
}
