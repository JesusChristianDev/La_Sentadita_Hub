import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { getCurrentUserContext } from '@/modules/auth_users';
import { can } from '@/modules/authz';
import { listTaskInstances } from '@/modules/tasks';
import { TasksPageClient } from '@/modules/tasks/ui/TasksPageClient';

export const metadata = {
  title: 'Tareas | La Sentadita Hub',
};

export default async function TasksPage() {
  const ctx = await getCurrentUserContext();
  if (!ctx) redirect('/login');

  const canViewTasks = can(ctx.requestContext, 'tasks.view');
  if (!canViewTasks) {
    redirect('/app'); // or unauthorized page
  }

  const effectiveRestaurantId = ctx.requestContext.effectiveRestaurantId;

  if (!effectiveRestaurantId) {
    return (
      <main className="app-shell stack rise-in">
        <section className="page-intro">
          <div>
            <h1 className="page-title">Tareas</h1>
            <p className="subtitle">Selecciona una sucursal para ver las tareas asignadas.</p>
          </div>
        </section>
      </main>
    );
  }

  // Get current date formatted as YYYY-MM-DD
  const today = new Date().toISOString().split('T')[0];
  const initialTasks = await listTaskInstances(effectiveRestaurantId, today);

  const isTaskManager = can(ctx.requestContext, 'tasks.manage');

  return (
    <main className="app-shell stack rise-in">
      <section className="page-intro">
        <div>
          <h1 className="page-title">Tareas</h1>
          <p className="subtitle">Gestión de tareas operativas y comprobaciones.</p>
        </div>
      </section>

      <section className="panel flex-1 flex flex-col min-h-0">
        <div className="flex-1 overflow-auto rounded-lg border border-border/50 bg-background/50">
          <Suspense fallback={<div className="p-8 text-center text-muted">Cargando tareas...</div>}>
            <TasksPageClient
              initialTasks={initialTasks}
              restaurantId={effectiveRestaurantId}
              isManagerOrAdmin={
                isTaskManager && ctx.requestContext.systemRole !== 'area_lead'
              }
            />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
