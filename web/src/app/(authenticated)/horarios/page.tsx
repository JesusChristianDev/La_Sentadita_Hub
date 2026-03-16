import '../../../modules/schedule/ui/schedule.css';

import { redirect } from 'next/navigation';

import { getCurrentUserContext, getEffectiveRestaurantId } from '@/modules/auth_users';
import {
  loadEmployeeScheduleWeekAction,
  loadScheduleHomeAction,
} from '@/modules/schedule/application/serverActions';
import ScheduleEditor from '@/modules/schedule/ui/ScheduleEditor';
import { canPickRestaurantHeader } from '@/shared/headerPolicy';
import { canAccessSchedulesModule } from '@/shared/schedulePolicy';
import { RestaurantContextEmptyState } from '@/shared/ui';

export default async function SchedulePage() {
  const ctx = await getCurrentUserContext();

  if (!ctx) {
    redirect('/login');
  }

  if (!canAccessSchedulesModule(ctx.profile)) {
    redirect('/app');
  }

  const restaurantId = await getEffectiveRestaurantId(ctx.profile);
  if (!restaurantId) {
    return (
      <main
        id="main-content"
        tabIndex={-1}
        className="app-shell app-shell--workspace schedule-shell stack rise-in"
      >
        <section className="page-intro schedule-page-intro">
          <div>
            <h1 className="page-title">Horarios</h1>
            <p className="subtitle">
              Semanas activas, edicion y consulta del calendario operativo.
            </p>
          </div>
        </section>

        <RestaurantContextEmptyState
          canPickRestaurant={canPickRestaurantHeader(ctx.profile.role)}
          moduleLabel="Horarios"
        />
      </main>
    );
  }

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
