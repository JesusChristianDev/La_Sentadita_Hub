import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getCurrentUserContext } from '@/modules/auth_users';
import { listEmployees } from '@/modules/employees';
import { listRestaurants } from '@/modules/restaurants';
import {
  type EmployeeErrorCode,
  type EmployeeStatusFilter,
  type EmployeeSuccessCode,
  getEmployeeErrorMessage,
  getEmployeeSuccessMessage,
} from '@/shared/feedbackMessages';
import { canPickRestaurantHeader, canSeeEmployeesInNav } from '@/shared/headerPolicy';
import { roleLabel } from '@/shared/roleLabel';
import { createSupabaseAdminClient } from '@/shared/supabase/admin';

import { setActiveRestaurant } from '../app/actions';
import { AppHeader } from '../components/app-header';
import { UserAvatar } from '../components/user-avatar';
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

function canCreate(role: string): boolean {
  return role === 'admin' || role === 'office';
}

export default async function EmployeesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const status = sp.status ?? 'active';

  const ctx = await getCurrentUserContext();
  if (!ctx) redirect('/login');

  if (ctx.profile.role === 'employee') redirect('/app');

  const store = await cookies();
  const activeRestaurantId = store.get('active_restaurant_id')?.value ?? null;
  const showSelector = canPickRestaurantHeader(ctx.profile.role);
  const restaurants = showSelector ? await listRestaurants() : [];
  const admin = createSupabaseAdminClient();
  let currentUserAvatarUrl: string | null = null;
  if (ctx.profile.avatar_path) {
    const { data } = await admin.storage.from('avatars').createSignedUrl(ctx.profile.avatar_path, 60 * 60);
    currentUserAvatarUrl = data?.signedUrl ?? null;
  }

  const restaurantId = canPickRestaurantHeader(ctx.profile.role)
    ? (activeRestaurantId ?? ctx.profile.restaurant_id)
    : ctx.profile.restaurant_id;

  if (!restaurantId) {
    return (
      <main id="main-content" tabIndex={-1} className="app-shell stack rise-in">
        <AppHeader
          canSeeEmployees
          canPickRestaurant={showSelector}
          restaurants={restaurants}
          effectiveRestaurantId={restaurantId}
          setActiveRestaurantAction={setActiveRestaurant}
          currentUserName={ctx.profile.full_name}
          currentUserRole={ctx.profile.role}
          currentUserAvatarUrl={currentUserAvatarUrl}
        />
        <h1 className="page-title">Equipo</h1>
        <p className="notice error">
          No hay restaurante efectivo. Ve a /app y selecciona un restaurante.
        </p>
      </main>
    );
  }

  const employees = await listEmployees(restaurantId, status);
  const avatarPaths = [
    ...new Set(
      employees
        .map((employee) => employee.avatar_path)
        .filter((path): path is string => Boolean(path)),
    ),
  ];
  const avatarUrlByPath = new Map<string, string>();

  await Promise.all(
    avatarPaths.map(async (path) => {
      const { data } = await admin.storage.from('avatars').createSignedUrl(path, 60 * 60);
      if (data?.signedUrl) avatarUrlByPath.set(path, data.signedUrl);
    }),
  );

  const errorMsg = getEmployeeErrorMessage(sp.e);
  const successMsg = getEmployeeSuccessMessage(sp.ok);
  const canManage = canCreate(ctx.profile.role);

  return (
    <main id="main-content" tabIndex={-1} className="app-shell stack rise-in">
      <AppHeader
        canSeeEmployees={canSeeEmployeesInNav(ctx.profile.role)}
        canPickRestaurant={showSelector}
        restaurants={restaurants}
        effectiveRestaurantId={restaurantId}
        setActiveRestaurantAction={setActiveRestaurant}
        currentUserName={ctx.profile.full_name}
        currentUserRole={ctx.profile.role}
        currentUserAvatarUrl={currentUserAvatarUrl}
      />

      <section className="page-intro">
        <h1 className="page-title">Equipo</h1>
        <p className="subtitle">Gestion de usuarios operativos por restaurante.</p>
      </section>

      {errorMsg ? (
        <p className="notice error" role="alert" aria-live="assertive">
          {errorMsg}
        </p>
      ) : null}
      {successMsg ? <p className="notice ok">{successMsg}</p> : null}

      <section className="panel">
        <div className="hero">
          <div>
            <h2 className="panel-title">Listado de empleados</h2>
            <p className="panel-subtitle">Filtra por estado y edita cada usuario.</p>
          </div>
          <div className="panel-actions">
            <nav className="chip-row">
              <Link
                className={status === 'active' ? 'chip active' : 'chip'}
                href="/employees?status=active"
              >
                Activos
              </Link>
              <Link
                className={status === 'inactive' ? 'chip active' : 'chip'}
                href="/employees?status=inactive"
              >
                Inactivos
              </Link>
              <Link
                className={status === 'all' ? 'chip active' : 'chip'}
                href="/employees?status=all"
              >
                Todos
              </Link>
            </nav>
            {canManage ? (
              <NewEmployeeDrawer
                restaurantId={restaurantId}
                canAssignManager={canPickRestaurantHeader(ctx.profile.role)}
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
                employees.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <div className="inline-flex items-center gap-2">
                        <UserAvatar
                          fullName={e.full_name}
                          role={e.role}
                          avatarUrl={e.avatar_path ? (avatarUrlByPath.get(e.avatar_path) ?? null) : null}
                          size="sm"
                        />
                        <span>{e.full_name || '(sin nombre)'}</span>
                      </div>
                    </td>
                    <td>{roleLabel(e.role)}</td>
                    <td>
                      <Link className="button secondary small" href={`/employees/${e.id}`}>
                        Editar
                      </Link>
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
            employees.map((e) => (
              <article key={e.id} className="mobile-employee-card">
                <div className="mb-2 inline-flex items-center gap-2">
                  <UserAvatar
                    fullName={e.full_name}
                    role={e.role}
                    avatarUrl={e.avatar_path ? (avatarUrlByPath.get(e.avatar_path) ?? null) : null}
                    size="md"
                  />
                  <strong>{e.full_name || '(sin nombre)'}</strong>
                </div>

                <p className="text-xs muted">rol</p>
                <p>{roleLabel(e.role)}</p>

                <div className="form-actions mt-3">
                  <Link className="button secondary w-full" href={`/employees/${e.id}`}>
                    Ver detalle
                  </Link>
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
