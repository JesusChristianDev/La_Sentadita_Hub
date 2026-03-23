import '../../../modules/schedule/ui/schedule.css';

import { redirect } from 'next/navigation';

import { getCurrentUserContext } from '@/modules/auth_users';
import { can } from '@/modules/authz';
import {
  loadEmployeeScheduleWeekAction,
  loadScheduleHomeAction,
} from '@/modules/schedule/application/serverActions';
import ScheduleEditor from '@/modules/schedule/ui/ScheduleEditor';
import { RestaurantContextEmptyState } from '@/shared/ui';

export default async function SchedulePage() {
  const ctx = await getCurrentUserContext();

  if (!ctx) {
    redirect('/login');
  }

  if (!can(ctx.requestContext, 'schedule.view')) {
    redirect('/app');
  }

  const restaurantId = ctx.requestContext.effectiveRestaurantId;
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
          canPickRestaurant={can(ctx.requestContext, 'restaurant_context.select')}
          moduleLabel="Horarios"
        />
      </main>
    );
  }

  const initialHome = await loadScheduleHomeAction(restaurantId);
  const initialEmployeeWeek = initialHome.permissions.is_employee_view
    ? await loadEmployeeScheduleWeekAction(
        initialHome.current_week.week_start,
        restaurantId,
      )
    : null;

  return (
    <ScheduleEditor
      actorName={ctx.person.full_name || 'Empleado'}
      initialEmployeeWeek={initialEmployeeWeek}
      initialHome={initialHome}
    />
  );
}
