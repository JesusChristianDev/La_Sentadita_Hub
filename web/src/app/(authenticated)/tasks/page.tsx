import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { buildFrontendSessionView, getCurrentUserContext } from '@/modules/auth_users';
import { buildTasksPageViewModel } from '@/modules/tasks/application/buildTasksPageViewModel';
import { TasksPageClient } from '@/modules/tasks/ui/TasksPageClient';
import { RestaurantContextEmptyState } from '@/shared/ui';

export const metadata = {
  title: 'Tareas | La Sentadita Hub',
};

export default async function TasksPage() {
  const ctx = await getCurrentUserContext();
  if (!ctx) redirect('/login');

  const frontendSession = buildFrontendSessionView(ctx);
  const viewModel = await buildTasksPageViewModel(ctx);

  if (viewModel.mode === 'forbidden') {
    redirect('/app');
  }

  if (
    viewModel.mode === 'context_required' ||
    viewModel.mode === 'global_overview' ||
    !viewModel.restaurantId
  ) {
    return (
      <main className="app-shell stack rise-in">
        <section className="page-intro">
          <div>
            <h1 className="page-title">Tareas</h1>
            <p className="subtitle">Gestion de tareas operativas y comprobaciones.</p>
          </div>
        </section>

        {viewModel.mode === 'global_overview' ? (
          <p className="panel-subtitle mt-4 text-sm text-muted">
            Estas en un scope global (organizacion/empresa). La vista agregada de tareas aun no
            esta implementada, pero ya no es obligatorio elegir un restaurante solo para entrar en
            la pantalla.
          </p>
        ) : (
          <RestaurantContextEmptyState
            canPickRestaurant={frontendSession.capabilities.context.canSelectRestaurant}
            moduleLabel="Tareas"
          />
        )}
      </main>
    );
  }

  return (
    <main className="app-shell stack rise-in">
      <section className="page-intro">
        <div>
          <h1 className="page-title">Tareas</h1>
          <p className="subtitle">Gestion de tareas operativas y comprobaciones.</p>
        </div>
      </section>

      <section className="panel flex min-h-0 flex-1 flex-col">
        <div className="flex-1 overflow-auto rounded-lg border border-border/50 bg-background/50">
          <Suspense
            fallback={<div className="p-8 text-center text-muted">Cargando tareas...</div>}
          >
            <TasksPageClient
              canManage={viewModel.canManage}
              initialTasks={viewModel.initialTasks}
              mode={viewModel.mode}
              restaurantId={viewModel.restaurantId ?? ''}
            />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
