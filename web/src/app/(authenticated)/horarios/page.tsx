import '../../../modules/schedule/ui/schedule.css';

import { redirect } from 'next/navigation';

import { getCurrentUserContext, getEffectiveRestaurantId } from '@/modules/auth_users';
import {
  loadEmployeeScheduleWeekAction,
  loadScheduleHomeAction,
} from '@/modules/schedule/application/serverActions';
import ScheduleEditor from '@/modules/schedule/ui/ScheduleEditor';
import { canAccessSchedulesModule } from '@/shared/schedulePolicy';

export default async function SchedulePage() {
  const ctx = await getCurrentUserContext();

  if (!ctx) {
    redirect('/login');
  }

  if (!canAccessSchedulesModule(ctx.profile)) {
    redirect('/app');
  }

  const restaurantId = await getEffectiveRestaurantId(ctx.profile);
  const initialHome = await loadScheduleHomeAction(restaurantId ?? undefined);
  const initialEmployeeWeek = initialHome.permissions.is_employee_view
    ? await loadEmployeeScheduleWeekAction(
        initialHome.current_week.week_start,
        restaurantId ?? undefined,
      )
    : null;

  return (
    <ScheduleEditor
      actorName={ctx.profile.full_name || 'Empleado'}
      initialEmployeeWeek={initialEmployeeWeek}
      initialHome={initialHome}
    />
  );
}
