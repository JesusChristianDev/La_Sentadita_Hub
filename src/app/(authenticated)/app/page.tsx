import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getCurrentUserContext } from '@/modules/auth_users';
import { listRestaurants } from '@/modules/restaurants';
import { canPickRestaurantHeader } from '@/shared/headerPolicy';
import { roleLabel } from '@/shared/roleLabel';

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

  const profileRestaurantName = ctx.profile.restaurant_id
    ? (restaurantsById.get(ctx.profile.restaurant_id) ?? 'Sucursal asignada')
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

      <section className="panel">
        <h2 className="panel-title">Resumen de perfil</h2>
        <p className="panel-subtitle">Informacion clave de tu acceso actual.</p>

        <dl className="meta-grid">
          <MetaItem label="Rol" value={roleLabel(ctx.profile.role)} />
          <MetaItem label="Restaurante activo" value={effectiveRestaurantName} />
          <MetaItem label="Restaurante del perfil" value={profileRestaurantName} />
          <MetaItem label="Usuario" value={ctx.profile.full_name || 'Sin nombre'} />
        </dl>
      </section>

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

          <article className="quick-card disabled">
            <h3>Horarios</h3>
            <p>Vista de turnos y cobertura del equipo.</p>
            <span className="tag">Proximamente</span>
          </article>

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

function MetaItem(props: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="meta-item">
      <dt className="meta-label">{props.label}</dt>
      <dd className={props.mono ? 'meta-value mono' : 'meta-value'}>{props.value}</dd>
    </div>
  );
}
