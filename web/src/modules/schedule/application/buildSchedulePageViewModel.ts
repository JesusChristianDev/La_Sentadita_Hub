import 'server-only';

import { buildFrontendSessionView, type CurrentSession } from '@/modules/auth_users';

import type { EmployeeScheduleWeekView, ScheduleHomePayload } from '../domain/scheduleTypes';
import { loadEmployeeScheduleWeekAction, loadScheduleHomeAction } from './serverActions';

export type SchedulePageViewModel = {
  initialEmployeeWeek: EmployeeScheduleWeekView | null;
  initialHome: ScheduleHomePayload | null;
  mode: 'context_required' | 'employee_view' | 'forbidden' | 'workspace';
};

export async function buildSchedulePageViewModel(
  session: CurrentSession,
): Promise<SchedulePageViewModel> {
  const frontendSession = buildFrontendSessionView(session);

  if (!frontendSession.capabilities.schedules.view) {
    return {
      initialEmployeeWeek: null,
      initialHome: null,
      mode: 'forbidden',
    };
  }

  if (!frontendSession.effectiveRestaurantId) {
    return {
      initialEmployeeWeek: null,
      initialHome: null,
      mode: 'context_required',
    };
  }

  const initialHome = await loadScheduleHomeAction(frontendSession.effectiveRestaurantId);
  const initialEmployeeWeek = initialHome.permissions.is_employee_view
    ? await loadEmployeeScheduleWeekAction(
        initialHome.current_week.week_start,
        frontendSession.effectiveRestaurantId,
      )
    : null;

  return {
    initialEmployeeWeek,
    initialHome,
    mode: initialHome.permissions.is_employee_view ? 'employee_view' : 'workspace',
  };
}
