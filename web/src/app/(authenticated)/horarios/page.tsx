import '../../../modules/schedule/ui/schedule.css';

import { redirect } from 'next/navigation';

import { buildFrontendSessionView, getCurrentUserContext } from '@/modules/auth_users';
import { buildSchedulePageViewModel } from '@/modules/schedule/application/buildSchedulePageViewModel';
import ScheduleEditor from '@/modules/schedule/ui/ScheduleEditor';
import { RestaurantContextEmptyState } from '@/shared/ui';

export default async function SchedulePage() {
  const ctx = await getCurrentUserContext();

  if (!ctx) {
    redirect('/login');
  }

  const frontendSession = buildFrontendSessionView(ctx);
  const viewModel = await buildSchedulePageViewModel(ctx);

  if (viewModel.mode === 'forbidden') {
    redirect('/app');
  }

  const isGlobalOverview = viewModel.mode === 'global_overview';

  if (!viewModel.initialHome) {
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

        {isGlobalOverview ? (
          <p className="panel-subtitle mt-4 text-sm text-muted">
            Estas en un scope global (organizacion/empresa). La vista agregada de horarios aun no
            esta implementada, pero ya no se bloquea la pantalla por no tener un restaurante
            efectivo seleccionado.
          </p>
        ) : (
          <RestaurantContextEmptyState
            canPickRestaurant={frontendSession.capabilities.context.canSelectRestaurant}
            moduleLabel="Horarios"
          />
        )}
      </main>
    );
  }

  const initialHome = viewModel.initialHome!;

  return (
    <ScheduleEditor
      actorName={ctx.person.full_name || 'Empleado'}
      initialEmployeeWeek={viewModel.initialEmployeeWeek}
      initialHome={initialHome}
    />
  );
}
