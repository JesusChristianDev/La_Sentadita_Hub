export type TaskStatus =
  | 'pending'
  | 'needs_reassignment'
  | 'completed'
  | 'overdue'
  | 'cancelled';

export type TaskCancelReason =
  | 'schedule_change'
  | 'employment_change'
  | 'template_deactivated'
  | 'manual_cancel';

export type TaskReassignmentReason =
  | 'employment_change'
  | 'request_conflict'
  | 'shift_swap'
  | 'manual_reassignment_required';

export type TaskTemplateRecord = {
  active: boolean;
  confirmation_employee_id: string | null;
  confirmation_mode: string | null;
  confirmation_role: string | null;
  created_at: string;
  description: string | null;
  due_rule: string;
  is_archived: boolean;
  plannable_in_schedule: boolean;
  recurrence_type: string;
  requires_confirmation: boolean;
  restaurant_id: string;
  task_template_id: string;
  title: string;
  updated_at: string;
};

export type TaskInstanceRecord = {
  assigned_employee_id: string | null;
  assigned_role: string | null;
  assigned_zone_id: string | null;
  cancel_reason: TaskCancelReason | null;
  completed_at: string | null;
  completed_by: string | null;
  confirmation_note: string | null;
  confirmation_photo_url: string | null;
  confirmed_at: string | null;
  confirmed_by: string | null;
  created_at: string;
  due_at: string | null;
  reassignment_reason: TaskReassignmentReason | null;
  requires_confirmation: boolean;
  restaurant_id: string;
  shift_context: string | null;
  task_date: string;
  task_instance_id: string;
  task_status: TaskStatus;
  task_template_id: string | null;
  updated_at: string;
};

export type CreateTaskTemplateInput = {
  confirmationEmployeeId?: string | null;
  confirmationMode?: string | null;
  confirmationRole?: string | null;
  description?: string | null;
  dueRule: string;
  plannableInSchedule?: boolean;
  recurrenceType: string;
  requiresConfirmation?: boolean;
  restaurantId: string;
  title: string;
};

export type CreateTaskInstanceInput = {
  assignedEmployeeId?: string | null;
  assignedRole?: string | null;
  assignedZoneId?: string | null;
  dueAt?: string | null;
  restaurantId: string;
  requiresConfirmation?: boolean;
  shiftContext?: string | null;
  taskDate: string;
  taskTemplateId?: string | null;
};

export type ReassignTaskInstanceInput = {
  assignedEmployeeId?: string | null;
  assignedRole?: string | null;
  assignedZoneId?: string | null;
  reason: TaskReassignmentReason;
  taskInstanceId: string;
};
