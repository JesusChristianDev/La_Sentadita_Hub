import { redirect } from 'next/navigation';

import { getCurrentUserContext } from '@/modules/auth_users';
import { buildRequestsPageViewModel } from '@/modules/requests/application/buildRequestsPageViewModel';
import { RequestsPageClient } from '@/modules/requests/ui/RequestsPageClient';

export const metadata = {
  title: 'Mis Solicitudes | La Sentadita Hub',
};

export default async function RequestsPage() {
  const ctx = await getCurrentUserContext();
  if (!ctx) {
    redirect('/login');
  }

  const viewModel = await buildRequestsPageViewModel(ctx);
  if (viewModel.mode === 'forbidden') {
    redirect('/app');
  }

  return (
    <main className="app-shell stack rise-in">
      <section className="page-intro">
        <div>
          <h1 className="page-title">Solicitudes</h1>
          <p className="subtitle">Gestion de solicitudes laborales y operativas.</p>
        </div>
      </section>

      <section className="panel flex min-h-0 flex-1 flex-col">
        <div className="flex-1 overflow-auto rounded-lg border border-border/50 bg-background/50">
          <RequestsPageClient
            currentEmploymentId={viewModel.currentEmploymentId ?? ''}
            initialRequests={viewModel.myRequests}
            mode={viewModel.mode}
            teamRequests={viewModel.teamRequests}
          />
        </div>
      </section>
    </main>
  );
}
