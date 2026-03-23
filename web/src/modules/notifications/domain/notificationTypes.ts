export type NotificationType =
  | 'schedule_published'
  | 'schedule_updated'
  | 'schedule_lock_force_released'
  | 'task_assigned'
  | 'task_due_soon'
  | 'task_overdue'
  | 'task_needs_reassignment'
  | 'task_cancelled'
  | 'procedure_created'
  | 'procedure_approved'
  | 'procedure_rejected'
  | 'procedure_cancelled'
  | 'procedure_in_review'
  | 'procedure_derived'
  | 'procedure_dates_updated'
  | 'shift_swap_request'
  | 'shift_swap_accepted'
  | 'shift_swap_rejected'
  | 'shift_swap_pending_manager'
  | 'shift_swap_manager_approved'
  | 'shift_swap_manager_rejected'
  | 'shift_swap_expired'
  | 'incident_created'
  | 'incident_assigned'
  | 'incident_status_changed'
  | 'incident_resolved'
  | 'document_uploaded'
  | 'document_requires_signature'
  | 'document_superseded'
  | 'system_role_changed'
  | 'employment_terminated'
  | 'password_must_change'
  | 'push_device_registered'
  | 'delivery_note_submitted'
  | 'delivery_note_confirmed'
  | 'delivery_note_rejected';

export type NotificationDeliveryType = 'in_app' | 'push';

export type NotificationRecord = {
  created_at: string;
  delivery_type: NotificationDeliveryType;
  entity_id: string | null;
  entity_type: string;
  notification_id: string;
  notification_type: NotificationType;
  read_at: string | null;
  recipient_user_id: string;
};

export type PushDeviceRecord = {
  auth_key: string;
  created_at: string;
  endpoint: string;
  last_seen_at: string;
  p256dh: string;
  person_id: string;
  platform: string | null;
  push_device_id: string;
};

export type NotifyPersonInput = {
  body?: string | null;
  entityId?: string | null;
  entityType: string;
  maxAttempts?: number;
  notificationType: NotificationType;
  recipientPersonId: string;
  scopeId?: string | null;
  scopeType?: 'chain' | 'company' | 'platform' | 'restaurant' | 'zone' | null;
  sendAfter?: string | null;
  sendPush?: boolean;
  title?: string | null;
  traceId?: string | null;
};

export type RegisterPushDeviceInput = {
  authKey: string;
  endpoint: string;
  p256dh: string;
  platform?: string | null;
};
