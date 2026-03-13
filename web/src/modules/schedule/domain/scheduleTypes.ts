export type DayType =
  | 'work'
  | 'rest'
  | 'unscheduled'
  | 'vacation'
  | 'sick_leave'
  | 'absent'
  | 'not_applicable'
  | 'end_of_contract';

export const EDITABLE_DAY_TYPES = [
  'work',
  'rest',
  'unscheduled',
  'vacation',
  'sick_leave',
  'absent',
] as const;
export type EditableDayType = (typeof EDITABLE_DAY_TYPES)[number];

export type ScheduleStatus = 'draft' | 'published';
export type ScheduleHomeStatus = ScheduleStatus | 'missing';
export type ScheduleViewMode = 'week' | 'day';

export type ShiftType = 'continuous' | 'split';

export interface ShiftTemplate {
  id: string;
  restaurant_id: string;
  name: string;
  type: ShiftType;
  start_time: string;
  end_time: string;
  split_start_time?: string | null;
  split_end_time?: string | null;
  is_active: boolean;
}

export interface ShiftTemplateDraftInput {
  name: string;
  type: ShiftType;
  start_time: string;
  end_time: string;
  split_start_time?: string | null;
  split_end_time?: string | null;
}

export interface RestaurantZone {
  id: string;
  restaurant_id: string;
  name: string;
  is_active: boolean;
}

export interface Schedule {
  id: string;
  restaurant_id: string;
  week_start: string; // ISO date
  status: ScheduleStatus;
  created_by: string;
  published_by?: string | null;
  published_at?: string | null;
  schedule_entries?: ScheduleEntry[];
}

export interface ScheduleWithEntries extends Schedule {
  schedule_entries: ScheduleEntry[];
}

export interface ScheduleWeekSummary {
  label?: string;
  week_start: string;
  week_end: string;
  schedule_id: string | null;
  has_published_version: boolean;
  status: ScheduleHomeStatus;
  missing_cells: number;
  validation_issues: number;
  needs_review: boolean;
  range_label?: string;
}

export interface ScheduleActorPermissions {
  can_manage: boolean;
  can_manage_templates: boolean;
  can_publish: boolean;
  can_review: boolean;
  is_area_lead: boolean;
  is_employee_view: boolean;
  view_scope?: 'restaurant' | 'zone' | 'self';
}

export interface SchedulePublicationState {
  affected_employee_count: number;
  can_publish: boolean;
  has_changes: boolean;
  publication_kind: 'initial' | 'republish';
}

export interface ScheduleHistoryWeekOption {
  range_label: string;
  week_start: string;
}

export interface ScheduleHomePayload {
  permissions: ScheduleActorPermissions;
  restaurant_id: string | null;
  current_week: ScheduleWeekSummary;
  history_weeks: ScheduleHistoryWeekOption[];
  next_week: ScheduleWeekSummary;
  shift_templates: ShiftTemplate[];
}

export interface ScheduleEntry {
  id: string;
  schedule_id: string;
  employee_id: string;
  date: string; // ISO date
  day_type: DayType;
  shift_template_id?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  split_start_time?: string | null;
  split_end_time?: string | null;
  start_ts?: string | null;
  end_ts?: string | null;
  split_start_ts?: string | null;
  split_end_ts?: string | null;
  zone_id?: string | null;
  source: 'manual' | 'auto';
  version: number;
}

export interface ScheduleIssueSummary {
  empty_cells: number;
  empty_keys: string[];
  invalid_cells: number;
  invalid_keys: string[];
}

export interface ScheduleEntryLog {
  change_source: 'manual' | 'auto';
  changed_at: string;
  changed_by: string | null;
  id: string;
  new_day_type: DayType | null;
  new_end_time: string | null;
  new_shift_template_id: string | null;
  new_split_end_time: string | null;
  new_split_start_time: string | null;
  new_start_time: string | null;
  new_zone_id: string | null;
  previous_day_type: DayType | null;
  previous_end_time: string | null;
  previous_shift_template_id: string | null;
  previous_split_end_time: string | null;
  previous_split_start_time: string | null;
  previous_start_time: string | null;
  previous_zone_id: string | null;
  schedule_entry_id: string;
}

export interface EmployeeScheduleDayView {
  date: string;
  day_type: DayType | 'unassigned';
  is_published: boolean;
  shift_text: string;
  tasks: string[];
}

export interface EmployeeScheduleWeekView {
  week_start: string;
  week_end?: string;
  range_label?: string;
  status: ScheduleStatus | 'unpublished';
  schedule_id: string | null;
  published_at: string | null;
  days: EmployeeScheduleDayView[];
}

export interface SchedulePublishReview {
  affected_employees?: Array<{
    full_name: string;
    id: string;
  }>;
  schedule_id: string;
  week_start: string;
  week_end: string;
  range_label?: string;
  publication_kind: 'initial' | 'republish';
  affected_employee_ids: string[];
  affected_employee_names: string[];
  missing_cells: number;
  validation_issues: number;
  can_publish: boolean;
  has_changes: boolean;
}

export interface ScheduleLock {
  acquired: boolean;
  can_force?: boolean;
  locked_by?: string | null;
  locked_by_name?: string | null;
  expires_at?: string | null;
}

export interface ScheduleConfig {
  min_shift_duration_minutes: number;
  min_split_break_minutes: number;
  timezone: string;
}

export type WeekDayIso = `${number}-${number}-${number}`;

export interface ParsedShift {
  start_time: string;
  end_time: string;
  split_start_time: string | null;
  split_end_time: string | null;
}

export type ShiftValidationResult =
  | { ok: true; shift: ParsedShift }
  | { ok: false; error: string };

export interface ScheduleLoadPayload<TEmployee> {
  schedule: ScheduleWithEntries;
  employees: TEmployee[];
  zones: RestaurantZone[];
  shift_templates: ShiftTemplate[];
  config: ScheduleConfig;
}

export interface ScheduleEditorPayload<TEmployee> extends ScheduleLoadPayload<TEmployee> {
  issues: ScheduleIssueSummary;
  permissions: ScheduleActorPermissions;
  publication_state: SchedulePublicationState;
}

export interface ScheduleSaveCellInput {
  date: string;
  employee_id: string;
  raw_value: string;
  schedule_id: string;
}

export interface ScheduleSaveCellResult {
  entry: ScheduleEntry;
  issues: ScheduleIssueSummary;
  publication_state: SchedulePublicationState;
  schedule_status: ScheduleStatus;
}
