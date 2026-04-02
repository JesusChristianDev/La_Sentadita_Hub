import { redirect } from 'next/navigation';

import { getCurrentUserContext } from '@/modules/auth_users';
import { buildDocumentsPageViewModel } from '@/modules/documents/application/buildDocumentsPageViewModel';
import { DocumentsPageClient } from '@/modules/documents/ui/DocumentsPageClient';

export const metadata = {
  title: 'Documentos | La Sentadita Hub',
};

export default async function DocumentsPage() {
  const ctx = await getCurrentUserContext();
  if (!ctx) {
    redirect('/login');
  }

  const viewModel = await buildDocumentsPageViewModel(ctx);
  if (viewModel.mode === 'forbidden') {
    redirect('/app');
  }

  return (
    <main className="app-shell stack rise-in">
      <section className="page-intro">
        <div>
          <h1 className="page-title">Documentos</h1>
          <p className="subtitle">Alta, visibilidad y archivo de documentos operativos.</p>
        </div>
      </section>

      <section className="panel flex min-h-0 flex-1 flex-col">
        <div className="flex-1 overflow-auto rounded-lg border border-border/50 bg-background/50">
          <DocumentsPageClient {...viewModel} />
        </div>
      </section>
    </main>
  );
}
