import type { EmployeeListItem } from '@/modules/employees';

import type {
  Schedule,
  ScheduleEntry,
  ScheduleIssueSummary,
  SchedulePublishReview,
  ScheduleWithEntries,
} from '../domain/scheduleTypes';
import { buildPublishReview } from './scheduleCalculations';
import { getPublishValidationError } from './scheduleDraftRules';

type ScopeEmployees = (employees: EmployeeListItem[]) => EmployeeListItem[];

type LoadPublishReviewDeps = {
  buildIssueSummaryForSchedule: (
    restaurantId: string,
    weekStart: string,
    entries: ScheduleEntry[],
    employees: EmployeeListItem[],
  ) => Promise<ScheduleIssueSummary>;
  getPublishedEntriesForSchedule: (schedule: ScheduleWithEntries) => Promise<ScheduleEntry[]>;
  listEmployees: (
    restaurantId: string,
    status?: 'active' | 'inactive' | 'all',
  ) => Promise<EmployeeListItem[]>;
};

type PublishScheduleDeps = LoadPublishReviewDeps & {
  publishScheduleWeek: (input: {
    actorUserId: string;
    affectedEmployeeIds: string[];
    comment?: string;
    schedule: ScheduleWithEntries;
  }) => Promise<Schedule>;
};

function identityScopeEmployees(employees: EmployeeListItem[]): EmployeeListItem[] {
  return employees;
}

export function createSchedulePublicationService(deps: PublishScheduleDeps) {
  async function loadPublishReview(params: {
    schedule: ScheduleWithEntries;
    scopeEmployees?: ScopeEmployees;
  }): Promise<SchedulePublishReview> {
    const employees = (params.scopeEmployees ?? identityScopeEmployees)(
      await deps.listEmployees(params.schedule.restaurant_id, 'active'),
    );
    const issues = await deps.buildIssueSummaryForSchedule(
      params.schedule.restaurant_id,
      params.schedule.week_start,
      params.schedule.schedule_entries,
      employees,
    );
    const publishedEntries = await deps.getPublishedEntriesForSchedule(params.schedule);

    return buildPublishReview({
      currentEntries: params.schedule.schedule_entries,
      employees,
      issues,
      publishedEntries,
      schedule: params.schedule,
    });
  }

  async function publishSchedule(params: {
    actorUserId: string;
    comment?: string;
    schedule: ScheduleWithEntries;
    scopeEmployees?: ScopeEmployees;
  }): Promise<Schedule> {
    const review = await loadPublishReview({
      schedule: params.schedule,
      scopeEmployees: params.scopeEmployees,
    });
    const publishValidationError = getPublishValidationError(review);
    if (publishValidationError) {
      throw new Error(`PUBLISH_VALIDATION_ERROR: ${publishValidationError}`);
    }

    return deps.publishScheduleWeek({
      actorUserId: params.actorUserId,
      affectedEmployeeIds: review.affected_employee_ids,
      comment: params.comment,
      schedule: params.schedule,
    });
  }

  return {
    loadPublishReview,
    publishSchedule,
  };
}
