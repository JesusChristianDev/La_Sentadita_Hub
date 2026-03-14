import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getCurrentUserContext } from '@/modules/auth_users';
import { DashboardHeroWidget } from '@/modules/dashboard';
import { listRestaurants } from '@/modules/restaurants';
import { canPickRestaurantHeader } from '@/shared/headerPolicy';
import { canAccessSchedulesModule } from '@/shared/schedulePolicy';

import { ClearInitialFocus } from '../../components/clear-initial-focus';

export default async function AppPage() {
  const ctx = await getCurrentUserContext();
  if (!ctx) redirect('/login');

  const store = await cookies();
  const activeRestaurantId = store.get('active_restaurant_id')?.value ?? null;

  const restaurants = await listRestaurants();
  const restaurantsById = new Map(restaurants.map((r) => [r.id, r.name]));

  const showSelector = canPickRestaurantHeader(ctx.profile.role);
  const effectiveRestaurantId = showSelector
    ? (activeRestaurantId ?? ctx.profile.restaurant_id)
    : ctx.profile.restaurant_id;

  const effectiveRestaurantName = effectiveRestaurantId
    ? (restaurantsById.get(effectiveRestaurantId) ?? 'Sucursal asignada')
    : 'Sin asignar';

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
        canPickRestaurant={showSelector}
        effectiveRestaurantName={effectiveRestaurantName}
        hasEffectiveRestaurant={Boolean(effectiveRestaurantId)}
        userName={ctx.profile.full_name || 'Sin nombre'}
      />

      <section className="panel">
        <h2 className="panel-title">Modulos</h2>
        <p className="panel-subtitle">Navega rapidamente hacia cada bloque funcional.</p>
        <div className="quick-grid">
          {ctx.profile.role !== 'employee' ? (
            <Link href="/employees" className="quick-card">
              <h3>Gestion de empleados</h3>
              <p>Alta, edicion y estado de usuarios operativos por restaurante.</p>
              <span className="tag">Disponible</span>
            </Link>
          ) : null}

          {canAccessSchedulesModule(ctx.profile.role) ? (
            <Link href="/horarios" className="quick-card">
              <h3>Horarios</h3>
              <p>Consulta o gestiona el horario semanal segun tus permisos.</p>
              <span className="tag">Disponible</span>
            </Link>
          ) : null}

          <article className="quick-card disabled">
            <h3>Tramites</h3>
            <p>Solicitudes internas y aprobaciones.</p>
            <span className="tag">Proximamente</span>
          </article>

          <article className="quick-card disabled">
            <h3>Documentos</h3>
            <p>Repositorio y consulta de archivos operativos.</p>
            <span className="tag">Proximamente</span>
          </article>
        </div>
      </section>
    </main>
  );
}
