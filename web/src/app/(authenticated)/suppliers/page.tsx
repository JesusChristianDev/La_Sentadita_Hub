import { redirect } from 'next/navigation';

import { getCurrentUserContext } from '@/modules/auth_users';
import { buildSuppliersPageViewModel } from '@/modules/suppliers/application/buildSuppliersPageViewModel';
import { SuppliersPageClient } from '@/modules/suppliers/ui/SuppliersPageClient';
import { RestaurantContextEmptyState } from '@/shared/ui';

export const metadata = {
  title: 'Proveedores y Compras | La Sentadita Hub',
};

export default async function SuppliersPage() {
  const ctx = await getCurrentUserContext();
  if (!ctx) {
    redirect('/login');
  }

  const viewModel = await buildSuppliersPageViewModel(ctx);
  if (viewModel.mode === 'context_required') {
    return (
      <main className="app-shell stack rise-in">
        <section className="page-intro">
          <div>
            <h1 className="page-title">Proveedores y compras</h1>
            <p className="subtitle">Catalogo de proveedores, productos y albaranes.</p>
          </div>
        </section>

        <RestaurantContextEmptyState
          canPickRestaurant={
            ctx.requestContext.systemRole === 'admin' ||
            ctx.requestContext.systemRole === 'owner' ||
            ctx.requestContext.systemRole === 'office'
          }
          moduleLabel="Proveedores y compras"
        />
      </main>
    );
  }

  return (
    <main className="app-shell stack rise-in">
      <section className="page-intro">
        <div>
          <h1 className="page-title">Proveedores y compras</h1>
          <p className="subtitle">Catalogo de proveedores, productos y albaranes.</p>
        </div>
      </section>

      <section className="panel flex min-h-0 flex-1 flex-col">
        <div className="flex-1 overflow-auto rounded-lg border border-border/50 bg-background/50">
          <SuppliersPageClient {...viewModel} />
        </div>
      </section>
    </main>
  );
}
