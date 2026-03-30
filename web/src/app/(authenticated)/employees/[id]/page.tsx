import { redirect } from 'next/navigation';

import { getCurrentUserContext } from '@/modules/auth_users';
import { can, deriveSystemRole } from '@/modules/authz';
import { listRestaurants } from '@/modules/restaurants';
import { loadPersonProfileById } from '@/shared/db/persons';
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

  const canPickRestaurant = can(ctx.requestContext, 'restaurant_context.select');
  if (!can(ctx.requestContext, 'employees.view')) redirect('/app');

  const admin = createSupabaseAdminClient();
  const profile = await loadPersonProfileById(id).catch(() => null);

  if (!profile) {
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

  const targetSystemRole = deriveSystemRole(profile);
  const editableRole =
    targetSystemRole === 'employee' ||
    targetSystemRole === 'area_lead' ||
    targetSystemRole === 'manager'
      ? targetSystemRole
      : 'employee';
  const isGlobalProfile =
    targetSystemRole === 'admin' ||
    targetSystemRole === 'owner' ||
    targetSystemRole === 'office';

  if (isGlobalProfile) {
    return (
      <main id="main-content" tabIndex={-1} className="app-shell stack rise-in">
        <h1 className="page-title">Usuario global</h1>
        <Notice>
          Este usuario es {roleLabel(targetSystemRole)} (global) y no se gestiona desde
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
    !can(ctx.requestContext, 'employees.manage_target', {
      targetRestaurantId: profile.restaurant_id,
      targetSystemRole,
    })
  ) {
    redirect(
      employeesPathWithError(
        targetSystemRole === 'manager' ? 'manager_protected' : 'restaurant_mismatch',
      ),
    );
  }

  const { data: authUser } = await admin.auth.admin.getUserById(id);
  const email = authUser.user?.email ?? '';

  const allRestaurants = await listRestaurants();
  const restaurants = canPickRestaurant
    ? allRestaurants
    : allRestaurants.filter(
        (restaurant) => restaurant.id === ctx.requestContext.effectiveRestaurantId,
      );

  const { data: restaurantZones } = await admin
    .from('restaurant_zones')
    .select('id, name')
    .eq('restaurant_id', profile.restaurant_id ?? '')
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

          {!canPickRestaurant ? (
            <label className="field">
              <span>Rol</span>
              <input type="hidden" name="role" value={editableRole} />
              <input className="input" value={roleLabel(targetSystemRole)} readOnly />
            </label>
          ) : (
            <label className="field">
              <span>Rol</span>
              <Select defaultValue={editableRole} name="role">
                <option value="employee">Empleado</option>
                <option value="area_lead">Encargado de zona</option>
                <option value="manager">Gerente</option>
              </Select>
            </label>
          )}

          {!canPickRestaurant ? (
            <label className="field">
              <span>Restaurante</span>
              <input
                type="hidden"
                name="restaurantId"
                value={ctx.requestContext.effectiveRestaurantId ?? ''}
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
                  .filter((restaurant) => restaurant.is_active)
                  .map((restaurant) => (
                    <option key={restaurant.id} value={restaurant.id}>
                      {restaurant.name}
                    </option>
                  ))}
              </Select>
            </label>
          )}

          <hr className="my-2 border-muted/20" />

          {editableRole === 'employee' || editableRole === 'area_lead' ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="field">
                <span>Zona predeterminada</span>
                <Select
                  name="zoneId"
                  defaultValue={profile.zone_id ?? ''}
                >
                  <option value="">(Sin zona)</option>
                  {restaurantZones?.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.name}
                    </option>
                  ))}
                </Select>
                <p className="mt-1 text-2xs muted">
                  Categorias sugeridas: Cocina, Sala, Barra.
                </p>
              </label>
            </div>
          ) : (
            <p className="py-2 text-sm muted">
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
            {profile.access_status}
          </span>
        </p>

        <EmployeeDangerZoneActions
          deactivateAction={deactivateAction}
          isActive={profile.access_status === 'active'}
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
