import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getCurrentUserContext } from '@/modules/auth_users';
import { can } from '@/modules/authz';
import { DashboardHeroWidget } from '@/modules/dashboard';
import { listRestaurants } from '@/modules/restaurants';

import { ClearInitialFocus } from '../../components/clear-initial-focus';

export default async function AppPage() {
  const ctx = await getCurrentUserContext();
  if (!ctx) redirect('/login');

  const restaurants = await listRestaurants();
  const restaurantsById = new Map(restaurants.map((restaurant) => [restaurant.id, restaurant.name]));

  const showSelector = can(ctx.requestContext, 'restaurant_context.select');
  const effectiveRestaurantId = ctx.requestContext.effectiveRestaurantId;
  const canViewEmployees = can(ctx.requestContext, 'employees.view');
  const canViewSchedules = can(ctx.requestContext, 'schedule.view');

  // TODO: Map exactly against ACL dictionary once definitions are locked
  const canViewTasks = true;
  const canViewRequests = true;

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
        userName={ctx.person.full_name || 'Sin nombre'}
      />

      <section className="panel">
        <h2 className="panel-title">Modulos</h2>
        <p className="panel-subtitle">Navega rapidamente hacia cada bloque funcional.</p>
        <div className="quick-grid">
          {canViewEmployees ? (
            <Link href="/employees" className="quick-card">
              <h3>Gestion de empleados</h3>
              <p>Alta, edicion y estado de usuarios operativos por restaurante.</p>
              <span className="tag">Disponible</span>
            </Link>
          ) : null}

          {canViewSchedules ? (
            <Link href="/horarios" className="quick-card">
              <h3>Horarios</h3>
              <p>Consulta o gestiona el horario semanal segun tus permisos.</p>
              <span className="tag">Disponible</span>
            </Link>
          ) : null}

          {canViewTasks ? (
            <Link href="/tasks" className="quick-card">
              <h3>Tareas</h3>
              <p>Operaciones diarias y comprobantes.</p>
              <span className="tag">Disponible</span>
            </Link>
          ) : null}

          {canViewRequests ? (
            <Link href="/requests" className="quick-card">
              <h3>Solicitudes</h3>
              <p>Solicitudes internas y aprobaciones.</p>
              <span className="tag">Disponible</span>
            </Link>
          ) : null}
        </div>
      </section>
    </main>
  );
}
