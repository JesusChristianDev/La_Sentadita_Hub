import { redirect } from 'next/navigation';

import { getCurrentUserContext } from '@/modules/auth_users';
import { can } from '@/modules/authz';
import { listEmployees } from '@/modules/employees';
import {
  type EmployeeErrorCode,
  type EmployeeStatusFilter,
  type EmployeeSuccessCode,
  getEmployeeErrorMessage,
  getEmployeeSuccessMessage,
} from '@/shared/feedbackMessages';
import { roleLabel } from '@/shared/roleLabel';
import { createSupabaseAdminClient } from '@/shared/supabase/admin';
import { ButtonLink, ChipLink, Notice, RestaurantContextEmptyState } from '@/shared/ui';

import { UserAvatar } from '../../components/user-avatar';
import { createEmployeeAction } from './actions';
import { NewEmployeeDrawer } from './new-employee-drawer';

type SearchParams = {
  e?: EmployeeErrorCode;
  ok?: EmployeeSuccessCode;
  status?: EmployeeStatusFilter;
};

type Props = {
  searchParams: Promise<SearchParams>;
};

export default async function EmployeesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const status = sp.status ?? 'active';

  const ctx = await getCurrentUserContext();
  if (!ctx) redirect('/login');

  const canPickRestaurant = can(ctx.requestContext, 'restaurant_context.select');
  const canManage = can(ctx.requestContext, 'employees.create');
  if (!can(ctx.requestContext, 'employees.view')) redirect('/app');

  const restaurantId = ctx.requestContext.effectiveRestaurantId;
  const admin = createSupabaseAdminClient();

  if (!restaurantId) {
    return (
      <main id="main-content" tabIndex={-1} className="app-shell stack rise-in">
        <section className="page-intro">
          <div>
            <h1 className="page-title">Equipo</h1>
            <p className="subtitle">Gestion de usuarios operativos por restaurante.</p>
          </div>
        </section>

        <RestaurantContextEmptyState
          canPickRestaurant={canPickRestaurant}
          moduleLabel="Equipo"
        />
      </main>
    );
  }

  const employees = await listEmployees(restaurantId, status);
  const avatarPaths = [
    ...new Set(
      employees.map((employee) => employee.avatar_path).filter((path): path is string => Boolean(path)),
    ),
  ];
  const avatarUrlByPath = new Map<string, string>();

  await Promise.all(
    avatarPaths.map(async (path) => {
      const { data } = await admin.storage.from('avatars').createSignedUrl(path, 60 * 60);
      if (data?.signedUrl) avatarUrlByPath.set(path, data.signedUrl);
    }),
  );

  const { data: restaurantZones } = await admin
    .from('restaurant_zones')
    .select('id, name')
    .eq('restaurant_id', restaurantId)
    .eq('is_active', true);

  const errorMsg = getEmployeeErrorMessage(sp.e);
  const successMsg = getEmployeeSuccessMessage(sp.ok);

  return (
    <main id="main-content" tabIndex={-1} className="app-shell stack rise-in">
      <section className="page-intro">
        <h1 className="page-title">Equipo</h1>
        <p className="subtitle">Gestion de usuarios operativos por restaurante.</p>
      </section>

      {errorMsg ? (
        <Notice tone="error" role="alert" aria-live="assertive">
          {errorMsg}
        </Notice>
      ) : null}
      {successMsg ? <Notice tone="ok">{successMsg}</Notice> : null}

      <section className="panel">
        <div className="hero">
          <div>
            <h2 className="panel-title">Listado de empleados</h2>
            <p className="panel-subtitle">Filtra por estado y edita cada usuario.</p>
          </div>
          <div className="panel-actions">
            <nav className="chip-row">
              <ChipLink active={status === 'active'} href="/employees?status=active">
                Activos
              </ChipLink>
              <ChipLink
                active={status === 'inactive'}
                href="/employees?status=inactive"
              >
                Inactivos
              </ChipLink>
              <ChipLink active={status === 'all'} href="/employees?status=all">
                Todos
              </ChipLink>
            </nav>
            {canManage ? (
              <NewEmployeeDrawer
                restaurantId={restaurantId}
                restaurantZones={restaurantZones || []}
                canAssignManager={canPickRestaurant}
                createEmployeeAction={createEmployeeAction}
              />
            ) : null}
          </div>
        </div>

        <div className="desktop-table mt-3 overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>nombre</th>
                <th>rol</th>
                <th>acciones</th>
              </tr>
            </thead>
            <tbody>
              {employees.length ? (
                employees.map((employee) => (
                  <tr key={employee.id}>
                    <td>
                      <div className="inline-flex items-center gap-2">
                        <UserAvatar
                          fullName={employee.full_name}
                          role={employee.system_role}
                          avatarUrl={
                            employee.avatar_path
                              ? (avatarUrlByPath.get(employee.avatar_path) ?? null)
                              : null
                          }
                          size="sm"
                        />
                        <span>{employee.full_name || '(sin nombre)'}</span>
                      </div>
                    </td>
                    <td>{roleLabel(employee.system_role)}</td>
                    <td>
                      <ButtonLink
                        href={`/employees/${employee.id}`}
                        size="small"
                        variant="secondary"
                      >
                        Editar
                      </ButtonLink>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="muted">
                    No hay empleados para este filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mobile-employee-list mt-3">
          {employees.length ? (
            employees.map((employee) => (
              <article key={employee.id} className="mobile-employee-card">
                <div className="mb-2 inline-flex items-center gap-2">
                  <UserAvatar
                    fullName={employee.full_name}
                    role={employee.system_role}
                    avatarUrl={
                      employee.avatar_path
                        ? (avatarUrlByPath.get(employee.avatar_path) ?? null)
                        : null
                    }
                    size="md"
                  />
                  <strong>{employee.full_name || '(sin nombre)'}</strong>
                </div>

                <p className="text-xs muted">rol</p>
                <p>{roleLabel(employee.system_role)}</p>

                <div className="form-actions mt-3">
                  <ButtonLink
                    className="w-full"
                    href={`/employees/${employee.id}`}
                    variant="secondary"
                  >
                    Ver detalle
                  </ButtonLink>
                </div>
              </article>
            ))
          ) : (
            <p className="muted">No hay empleados para este filtro.</p>
          )}
        </div>
      </section>
    </main>
  );
}
