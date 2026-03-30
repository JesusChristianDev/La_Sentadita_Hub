export const AUDIT_ACTIONS = {
  personCreated: 'person_created',
  personArchived: 'person_archived',
  personIdentityUpdated: 'person_identity_updated',
  systemRoleChanged: 'system_role_changed',
  employmentRelationshipCreated: 'employment_relationship_created',
  employmentRelationshipUpdated: 'employment_relationship_updated',
  employmentRelationshipTerminated: 'employment_relationship_terminated',
  roleScopeAssignmentCreated: 'role_scope_assignment_created',
  roleScopeAssignmentUpdated: 'role_scope_assignment_updated',
  roleScopeAssignmentDeactivated: 'role_scope_assignment_deactivated',
  moveCompany: 'move_company',
  moveRestaurant: 'move_restaurant',
  scheduleCreated: 'schedule_created',
  scheduleEntryUpdated: 'schedule_entry_updated',
  schedulePublished: 'schedule_published',
  scheduleRepublished: 'schedule_republished',
  scheduleLockAcquired: 'schedule_lock_acquired',
  scheduleLockDenied: 'schedule_lock_denied',
  scheduleLockExpired: 'schedule_lock_expired',
  scheduleLockForceReleased: 'schedule_lock_force_released',
  taskCreated: 'task_created',
  taskStatusChanged: 'task_status_changed',
  taskConfirmed: 'task_confirmed',
  taskReassigned: 'task_reassigned',
  taskCancelled: 'task_cancelled',
  taskGeneratedFromSchedule: 'task_generated_from_schedule',
  requestCreated: 'request_created',
  requestStatusChanged: 'request_status_changed',
  requestDerived: 'request_derived',
  requestAppliedToSchedule: 'request_applied_to_schedule',
  requestDatesUpdated: 'request_dates_updated',
  shiftSwapRequested: 'shift_swap_requested',
  shiftSwapPeerAccepted: 'shift_swap_peer_accepted',
  shiftSwapPeerRejected: 'shift_swap_peer_rejected',
  shiftSwapManagerApproved: 'shift_swap_manager_approved',
  shiftSwapManagerRejected: 'shift_swap_manager_rejected',
  shiftSwapExpired: 'shift_swap_expired',
  shiftSwapApplied: 'shift_swap_applied',
  incidentCreated: 'incident_created',
  incidentStatusChanged: 'incident_status_changed',
  incidentAssigned: 'incident_assigned',
  incidentRestrictedMarked: 'incident_restricted_marked',
  documentUploaded: 'document_uploaded',
  documentViewed: 'document_viewed',
  documentDownloaded: 'document_downloaded',
  documentArchived: 'document_archived',
  documentSuperseded: 'document_superseded',
  deliveryNoteUploaded: 'delivery_note_uploaded',
  deliveryNoteEmployeeReviewed: 'delivery_note_employee_reviewed',
  deliveryNoteOfficeConfirmed: 'delivery_note_office_confirmed',
  deliveryNoteOfficeRejected: 'delivery_note_office_rejected',
  supplierCreated: 'supplier_created',
  productCreated: 'product_created',
  notificationCreated: 'notification_created',
  notificationSent: 'notification_sent_push',
  notificationRead: 'notification_read',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export type AuditScopeType = 'organization' | 'company' | 'restaurant' | 'zone';

export type AuditJsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: AuditJsonValue }
  | AuditJsonValue[];

export type WriteAuditLogInput = {
  action: AuditAction;
  entityId: string | null;
  entityType: string;
  newValue?: AuditJsonValue;
  previousValue?: AuditJsonValue;
  reason?: string | null;
  scopeId?: string | null;
  scopeType?: AuditScopeType | null;
  traceId?: string | null;
};
