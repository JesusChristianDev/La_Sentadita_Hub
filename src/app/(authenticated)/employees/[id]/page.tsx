import Link from 'next/link';
import { redirect } from 'next/navigation';

import { listActiveAreaLeads, ZONES } from '@/modules/area_leads';
import { getCurrentUserContext } from '@/modules/auth_users';
import { listRestaurants } from '@/modules/restaurants';
import {
  type EmployeeErrorCode,
  employeesPathWithError,
  getEmployeeErrorMessage,
} from '@/shared/feedbackMessages';
import { roleLabel } from '@/shared/roleLabel';
import { createSupabaseAdminClient } from '@/shared/supabase/admin';

import {
  assignAreaLeadAction,
  deactivateEmployeeAction,
  reactivateEmployeeAction,
  revokeAreaLeadAction,
  softDeleteEmployeeAction,
  updateEmployeeAction,
} from './actions';

type SearchParams = { e?: EmployeeErrorCode };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
};

export default async function EmployeeDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;

  const ctx = await getCurrentUserContext();
  if (!ctx) redirect('/login');

  if (ctx.profile.role === 'employee') redirect('/app');

  const admin = createSupabaseAdminClient();

  const { data: profile, error } = await admin
    .from('profiles')
    .select('id, full_name, role, restaurant_id, is_active')
    .eq('id', id)
    .single();

  if (error || !profile) {
    return (
      <main id="main-content" tabIndex={-1} className="app-shell stack rise-in">
        <h1 className="page-title">Empleado</h1>
        <p className="notice error">No encontrado.</p>
        <p className="text-sm">
          <Link className="button secondary" href="/employees">
            Volver
          </Link>
        </p>
      </main>
    );
  }

  if (profile.role === 'admin' || profile.role === 'office') {
    return (
      <main id="main-content" tabIndex={-1} className="app-shell stack rise-in">
        <h1 className="page-title">Usuario global</h1>
        <p className="notice">
          Este usuario es {roleLabel(profile.role)} (global) y no se gestiona desde Equipo.
        </p>
        <p className="text-sm">
          <Link className="button secondary" href="/employees">
            Volver
          </Link>
        </p>
      </main>
    );
  }

  if (
    profile.role === 'manager' &&
    ctx.profile.role !== 'admin' &&
    ctx.profile.role !== 'office'
  ) {
    redirect(employeesPathWithError('manager_protected'));
  }

  if (
    (ctx.profile.role === 'manager' || ctx.profile.role === 'sub_manager') &&
    profile.restaurant_id !== ctx.profile.restaurant_id
  ) {
    redirect(employeesPathWithError('restaurant_mismatch'));
  }

  const { data: authUser } = await admin.auth.admin.getUserById(id);
  const email = authUser.user?.email ?? '';

  const allRestaurants = await listRestaurants();
  
  const restaurants =
    ctx.profile.role === 'manager' || ctx.profile.role === 'sub_manager'
      ? allRestaurants.filter((r) => r.id === ctx.profile.restaurant_id)
      : allRestaurants;
      
  const activeAreaLeads = profile.restaurant_id
    ? await listActiveAreaLeads(profile.restaurant_id)
    : [];
    
  const userAreaLeads = activeAreaLeads
    .filter((lead) => lead.user_id === profile.id)
    .sort((a, b) => {
      if (a.zone === b.zone) return a.lead_slot - b.lead_slot;
      return a.zone.localeCompare(b.zone);
    });
    
  const zoneLabelByKey = new Map(ZONES.map((zone) => [zone.key, zone.label]));
  const errorMsg = getEmployeeErrorMessage(sp.e);

  return (
    <main id="main-content" tabIndex={-1} className="app-shell stack rise-in">
      <section className="page-intro">
        <div>
          <h1 className="page-title">Editar empleado</h1>
          <p className="subtitle">Ajusta datos personales, rol y estado operativo.</p>
        </div>
        <div className="page-intro-actions">
          <Link className="button secondary" href="/employees">
            Volver al listado
          </Link>
        </div>
      </section>

      {errorMsg ? (
        <p className="notice error" role="alert" aria-live="assertive">
          {errorMsg}
        </p>
      ) : null}

      <section className="panel">
        <h2 className="panel-title">Datos</h2>
        <p className="panel-subtitle">Actualiza los campos y guarda para aplicar cambios.</p>

        <form action={updateEmployeeAction.bind(null, id)} className="mt-3 grid gap-3">
          <label className="field">
            <span>Email (Auth)</span>
            <input defaultValue={email} name="email" className="input" />
          </label>

          <label className="field">
            <span>Nueva contrasena (opcional)</span>
            <input name="password" type="password" className="input" />
          </label>

          <label className="field">
            <span>Nombre completo</span>
            <input
              defaultValue={profile.full_name ?? ''}
              name="fullName"
              className="input"
            />
          </label>

          {ctx.profile.role === 'manager' || ctx.profile.role === 'sub_manager' ? (
            <label className="field">
              <span>Rol</span>
              <input type="hidden" name="role" value={profile.role} />
              <input className="input" value={roleLabel(profile.role)} readOnly />
            </label>
          ) : (
            <label className="field">
              <span>Rol</span>
              <select defaultValue={profile.role} name="role" className="select">
                <option value="employee">Empleado</option>
                <option value="sub_manager">Subgerente</option>
                <option value="manager">Gerente</option>
              </select>
            </label>
          )}

          {ctx.profile.role === 'manager' || ctx.profile.role === 'sub_manager' ? (
            <label className="field">
              <span>Restaurante</span>
              <input
                type="hidden"
                name="restaurantId"
                value={ctx.profile.restaurant_id ?? ''}
              />
              <input
                className="input"
                value={restaurants[0]?.name ?? '(sin restaurante)'}
                readOnly
              />
            </label>
          ) : (
            <label className="field">
              <span>Restaurante</span>
              <select
                defaultValue={profile.restaurant_id ?? ''}
                name="restaurantId"
                className="select"
              >
                <option value="" disabled>
                  Selecciona...
                </option>
                {restaurants
                  .filter((r) => r.is_active)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
              </select>
            </label>
          )}

          <button className="button" type="submit">
            Guardar
          </button>
        </form>
      </section>

      {profile.role === 'employee' ? (
        <section className="panel">
          <h2 className="panel-title">Encargado de zona</h2>
          <p className="panel-subtitle">
            Solo usuarios con rol Empleado pueden ser encargados de zona.
          </p>

          {profile.restaurant_id ? (
            <>
              {userAreaLeads.length ? (
                <div className="mt-3 grid gap-2">
                  {userAreaLeads.map((lead) => (
                    <div key={lead.id} className="inline-flex items-center gap-2">
                      <span className="chip active">
                        {zoneLabelByKey.get(lead.zone) ?? lead.zone} - Slot{' '}
                        {lead.lead_slot}
                      </span>
                      <form action={revokeAreaLeadAction.bind(null, id, lead.id)}>
                        <button className="button secondary small" type="submit">
                          Quitar
                        </button>
                      </form>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm muted">
                  Este empleado no tiene zonas asignadas.
                </p>
              )}

              <form
                action={assignAreaLeadAction.bind(null, id)}
                className="mt-3 grid gap-3"
              >
                <label className="field">
                  <span>Zona</span>
                  <select name="zone" className="select" defaultValue={ZONES[0]?.key}>
                    {ZONES.map((zone) => (
                      <option key={zone.key} value={zone.key}>
                        {zone.label}
                      </option>
                    ))}
                  </select>
                </label>

                <p className="text-xs muted">
                  El cupo se asigna automaticamente (maximo 2 por zona).
                </p>

                <button className="button" type="submit">
                  Asignar zona
                </button>
              </form>
            </>
          ) : (
            <p className="mt-3 text-sm muted">
              Sin restaurante asignado, no se puede definir zona.
            </p>
          )}
        </section>
      ) : null}

      <section className="panel">
        <h2 className="panel-title">Estado</h2>
        <p className="panel-subtitle">Controla la disponibilidad del usuario en el sistema.</p>

        <p className="mt-2 text-sm muted">
          Estado:{' '}
          <span className="font-semibold">
            {profile.is_active ? 'activo' : 'desactivado'}
          </span>
        </p>

        <div className="form-actions mt-3">
          {profile.is_active ? (
            <form action={deactivateEmployeeAction.bind(null, id)}>
              <button className="button secondary small" type="submit">
                Desactivar
              </button>
            </form>
          ) : (
            <form action={reactivateEmployeeAction.bind(null, id)}>
              <button className="button small" type="submit">
                Reactivar
              </button>
            </form>
          )}

          <form action={softDeleteEmployeeAction.bind(null, id)}>
            <button className="button danger small" type="submit">
              Eliminar (soft)
            </button>
          </form>
        </div>

        <p className="mt-3 text-xs muted">
          Eliminar (soft) desactiva el usuario en Auth (no es borrado duro).
        </p>
      </section>
    </main>
  );
}
