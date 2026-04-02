import Link from 'next/link';
import { redirect } from 'next/navigation';

import { buildFrontendSessionView, getCurrentUserContext } from '@/modules/auth_users';
import {
  buildDashboardPageViewModel,
  DashboardHeroWidget,
} from '@/modules/dashboard';

import { ClearInitialFocus } from '../../components/clear-initial-focus';

export default async function AppPage() {
  const ctx = await getCurrentUserContext();
  if (!ctx) redirect('/login');
  const frontendSession = buildFrontendSessionView(ctx);
  const viewModel = buildDashboardPageViewModel(frontendSession);

  return (
    <main id="main-content" tabIndex={-1} className="app-shell stack rise-in">
      <ClearInitialFocus />

      <section className="page-intro">
        <div>
          <h1 className="page-title">Panel principal</h1>
          <p className="subtitle">Resumen operativo y accesos rapidos de tu jornada.</p>
        </div>
      </section>

      <DashboardHeroWidget
        canPickRestaurant={viewModel.hero.canPickRestaurant}
        effectiveRestaurantName={viewModel.hero.effectiveRestaurantName}
        hasEffectiveRestaurant={viewModel.hero.hasEffectiveRestaurant}
        userName={viewModel.hero.userName}
      />

      <section className="panel">
        <h2 className="panel-title">Modulos</h2>
        <p className="panel-subtitle">Navega rapidamente hacia cada bloque funcional.</p>
        <div className="quick-grid">
          {viewModel.shortcuts.map((shortcut) => (
            <Link key={shortcut.href} href={shortcut.href} className="quick-card">
              <h3>{shortcut.label}</h3>
              <p>{shortcut.description}</p>
              <span className="tag">Disponible</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
