import type { DeliveryNoteStatus } from './deliveryNoteTypes';

// Forward-only workflow: uploaded → employee_reviewed → office_reviewing → confirmed | rejected
const ALLOWED_TRANSITIONS = new Map<DeliveryNoteStatus, Set<DeliveryNoteStatus>>([
  ['uploaded',          new Set<DeliveryNoteStatus>(['employee_reviewed', 'office_reviewing'])],
  ['employee_reviewed', new Set<DeliveryNoteStatus>(['office_reviewing'])],
  ['office_reviewing',  new Set<DeliveryNoteStatus>(['confirmed', 'rejected'])],
  ['confirmed',         new Set<DeliveryNoteStatus>()],
  ['rejected',          new Set<DeliveryNoteStatus>()],
]);

export function isValidDeliveryNoteTransition(
  from: DeliveryNoteStatus,
  to: DeliveryNoteStatus,
): boolean {
  return ALLOWED_TRANSITIONS.get(from)?.has(to) ?? false;
}

export function assertValidDeliveryNoteTransition(
  from: DeliveryNoteStatus,
  to: DeliveryNoteStatus,
): void {
  if (!isValidDeliveryNoteTransition(from, to)) {
    throw new Error(
      `DELIVERY_NOTE_INVALID_TRANSITION: No se puede pasar de '${from}' a '${to}'.`,
    );
  }
}

export function isTerminalDeliveryNoteStatus(status: DeliveryNoteStatus): boolean {
  return status === 'confirmed' || status === 'rejected';
}
