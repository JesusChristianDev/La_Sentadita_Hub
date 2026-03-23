export type ProcedureType =
  | 'vacation'
  | 'sick_leave'
  | 'justified_absence'
  | 'absence';

export type ProcedureStatus =
  | 'requested'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'expired'
  | 'reported'
  | 'validated'
  | 'closed'
  | 'in_review'
  | 'resolved';

export type ShiftSwapStatus =
  | 'pending_peer'
  | 'pending_manager'
  | 'approved'
  | 'rejected_peer'
  | 'rejected_manager'
  | 'expired';

export type ProcedureRecord = {
  created_at: string;
  effective_end_date: string | null;
  effective_start_date: string | null;
  employment_id: string;
  procedure_id: string;
  procedure_type: ProcedureType;
  requested_by: string;
  resolution_note: string | null;
  reviewed_by: string | null;
  status: ProcedureStatus;
  updated_at: string;
};

export type ShiftSwapRequestRecord = {
  peer_responded_at: string | null;
  reason: string | null;
  requested_at: string;
  requester_employee_id: string;
  requester_schedule_entry_id: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  shift_swap_request_id: string;
  status: ShiftSwapStatus;
  target_employee_id: string;
  target_schedule_entry_id: string;
};

export type CreateProcedureInput = {
  effectiveEndDate?: string | null;
  effectiveStartDate?: string | null;
  employmentId: string;
  procedureType: ProcedureType;
};

export type ReviewProcedureInput = {
  procedureId: string;
  resolutionNote?: string | null;
  status: Exclude<ProcedureStatus, 'requested'>;
};

export type CreateShiftSwapRequestInput = {
  reason?: string | null;
  requesterScheduleEntryId: string;
  targetScheduleEntryId: string;
};
