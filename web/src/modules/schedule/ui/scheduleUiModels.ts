import type {
  EmployeeScheduleWeekView,
  ScheduleHomePayload,
} from '../domain/scheduleTypes';

export type ScheduleEditorSurface = 'home' | 'editor' | 'publish' | 'employee';
export type ScheduleEditorMode = 'edit' | 'view';
export type ScheduleDisplayMode = 'week' | 'day';
export type ScheduleCellTypeFilter =
  | 'absent'
  | 'all'
  | 'rest'
  | 'sick_leave'
  | 'vacation'
  | 'work';
export type ScheduleProblemFilter = 'all' | 'issues';
export type ScheduleZoneFilter = 'all' | 'unassigned' | string;
export type ScheduleDayOption = {
  index: number;
  label: string;
};

export type ScheduleGridHealth = {
  emptyCount: number;
  invalidCount: number;
};

export type ScheduleEditorShellProps = {
  actorName: string;
  initialEmployeeWeek?: EmployeeScheduleWeekView | null;
  initialHome: ScheduleHomePayload;
};
