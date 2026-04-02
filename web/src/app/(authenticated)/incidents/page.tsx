import { redirect } from 'next/navigation';

import { getCurrentUserContext } from '@/modules/auth_users';
import { can } from '@/modules/authz';
import { buildIncidentsPageViewModel } from '@/modules/incidents/application/buildIncidentsPageViewModel';
import { IncidentsPageClient } from '@/modules/incidents/ui/IncidentsPageClient';
import { RestaurantContextEmptyState } from '@/shared/ui';

export const metadata = {
  title: 'Incidencias | La Sentadita Hub',
};

export default async function IncidentsPage() {
  const ctx = await getCurrentUserContext();
  if (!ctx) redirect('/login');

  const viewModel = await buildIncidentsPageViewModel(ctx);

  if (viewModel.mode === 'forbidden') {
    redirect('/app');
  }

  if (viewModel.mode === 'context_required' || !viewModel.currentRestaurantId) {
    return (
      <main className="app-shell stack rise-in">
        <section className="page-intro">
          <div>
            <h1 className="page-title">Incidencias</h1>
            <p className="subtitle">Gestion de incidencias operativas y sensibles.</p>
          </div>
        </section>

        <RestaurantContextEmptyState
          canPickRestaurant={can(ctx.requestContext, 'restaurant_context.select')}
          moduleLabel="Incidencias"
        />
      </main>
    );
  }

  return (
    <main className="app-shell stack rise-in">
      <section className="page-intro">
        <div>
          <h1 className="page-title">Incidencias</h1>
          <p className="subtitle">Gestion de incidencias operativas y sensibles.</p>
        </div>
      </section>

      <section className="panel flex min-h-0 flex-1 flex-col">
        <div className="flex-1 overflow-auto rounded-lg border border-border/50 bg-background/50">
          <IncidentsPageClient
            canCreate={viewModel.canCreate}
            canManage={viewModel.canManage}
            currentRestaurantId={viewModel.currentRestaurantId}
            currentRestaurantName={viewModel.currentRestaurantName}
            incidents={viewModel.incidents}
            ownerOptions={viewModel.ownerOptions}
            zones={viewModel.zones}
          />
        </div>
      </section>
    </main>
  );
}
