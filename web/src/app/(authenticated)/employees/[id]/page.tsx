import { redirect } from 'next/navigation';

import { getCurrentUserContext } from '@/modules/auth_users';
import { listRestaurants } from '@/modules/restaurants';
import {
  type EmployeeErrorCode,
  employeesPathWithError,
  getEmployeeErrorMessage,
} from '@/shared/feedbackMessages';
import { roleLabel } from '@/shared/roleLabel';
import { createSupabaseAdminClient } from '@/shared/supabase/admin';
import { Button, ButtonLink, Notice, Select } from '@/shared/ui';

import {
  deactivateEmployeeAction,
  reactivateEmployeeAction,
  softDeleteEmployeeAction,
  updateEmployeeAction,
} from './actions';
import { EmployeeDangerZoneActions } from './EmployeeDangerZoneActions';

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
    .select('id, full_name, role, restaurant_id, is_active, zone_id, is_area_lead')
    .eq('id', id)
    .single();

  if (error || !profile) {
    return (
      <main id="main-content" tabIndex={-1} className="app-shell stack rise-in">
        <h1 className="page-title">Empleado</h1>
        <Notice tone="error">No encontrado.</Notice>
        <p className="text-sm">
          <ButtonLink href="/employees" variant="secondary">
            Volver
          </ButtonLink>
        </p>
      </main>
    );
  }

  if (profile.role === 'admin' || profile.role === 'office') {
    return (
      <main id="main-content" tabIndex={-1} className="app-shell stack rise-in">
        <h1 className="page-title">Usuario global</h1>
        <Notice>
          Este usuario es {roleLabel(profile.role)} (global) y no se gestiona desde
          Equipo.
        </Notice>
        <p className="text-sm">
          <ButtonLink href="/employees" variant="secondary">
            Volver
          </ButtonLink>
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

  // Obtener zonas del restaurante para el combo
  const { data: restaurantZones } = await admin
    .from('restaurant_zones')
    .select('id, name')
    .eq('restaurant_id', profile.restaurant_id || '')
    .eq('is_active', true);

  const errorMsg = getEmployeeErrorMessage(sp.e);
  const deactivateAction = deactivateEmployeeAction.bind(null, id);
  const reactivateAction = reactivateEmployeeAction.bind(null, id);
  const softDeleteAction = softDeleteEmployeeAction.bind(null, id);

  return (
    <main id="main-content" tabIndex={-1} className="app-shell stack rise-in">
      <section className="page-intro">
        <div>
          <h1 className="page-title">Editar empleado</h1>
          <p className="subtitle">Ajusta datos personales, rol y estado operativo.</p>
        </div>
        <div className="page-intro-actions">
          <ButtonLink href="/employees" variant="secondary">
            Volver al listado
          </ButtonLink>
        </div>
      </section>

      {errorMsg ? (
        <Notice tone="error" role="alert" aria-live="assertive">
          {errorMsg}
        </Notice>
      ) : null}

      <section className="panel">
        <h2 className="panel-title">Datos</h2>
        <p className="panel-subtitle">
          Actualiza los campos y guarda para aplicar cambios.
        </p>

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
              <Select defaultValue={profile.role} name="role">
                <option value="employee">Empleado</option>
                <option value="sub_manager">Subgerente</option>
                <option value="manager">Gerente</option>
              </Select>
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
              <Select
                defaultValue={profile.restaurant_id ?? ''}
                name="restaurantId"
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
              </Select>
            </label>
          )}

          <hr className="my-2 border-muted/20" />

          {profile.role === 'employee' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="field">
                <span>Zona predeterminada</span>
                <Select
                  name="zoneId"
                  defaultValue={profile.zone_id ?? ''}
                >
                  <option value="">(Sin zona)</option>
                  {restaurantZones?.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name}
                    </option>
                  ))}
                </Select>
                <p className="text-2xs muted mt-1">
                  Categorias sugeridas: Cocina, Sala, Barra.
                </p>
              </label>

              <div className="flex items-center gap-2 mt-auto pb-2">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="isAreaLead"
                    value="1"
                    defaultChecked={profile.is_area_lead}
                    className="checkbox"
                  />
                  <span>Es encargado de zona</span>
                </label>
              </div>
            </div>
          ) : (
            <p className="text-sm muted py-2">
              Los roles de gestion no tienen zona asignada ni pueden ser encargados.
            </p>
          )}

          <Button className="mt-2" type="submit">
            Guardar cambios
          </Button>
        </form>
      </section>

      <section className="panel">
        <h2 className="panel-title">Estado</h2>
        <p className="panel-subtitle">
          Controla la disponibilidad del usuario en el sistema.
        </p>

        <p className="mt-2 text-sm muted">
          Estado:{' '}
          <span className="font-semibold">
            {profile.is_active ? 'activo' : 'desactivado'}
          </span>
        </p>

        <EmployeeDangerZoneActions
          deactivateAction={deactivateAction}
          isActive={profile.is_active}
          reactivateAction={reactivateAction}
          softDeleteAction={softDeleteAction}
        />

        <p className="mt-3 text-xs muted">
          Eliminar (soft) desactiva el usuario en Auth (no es borrado duro).
        </p>
      </section>
    </main>
  );
}
