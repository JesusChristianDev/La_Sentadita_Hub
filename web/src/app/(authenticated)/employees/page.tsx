import { redirect } from 'next/navigation';

import { getCurrentUserContext, getEffectiveRestaurantId } from '@/modules/auth_users';
import { listEmployees } from '@/modules/employees';
import {
  type EmployeeErrorCode,
  type EmployeeStatusFilter,
  type EmployeeSuccessCode,
  getEmployeeErrorMessage,
  getEmployeeSuccessMessage,
} from '@/shared/feedbackMessages';
import { canPickRestaurantHeader } from '@/shared/headerPolicy';
import { roleLabel } from '@/shared/roleLabel';
import { createSupabaseAdminClient } from '@/shared/supabase/admin';
import { ButtonLink, ChipLink, Notice } from '@/shared/ui';

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

function canCreate(role: string): boolean {
  return role === 'admin' || role === 'office';
}

export default async function EmployeesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const status = sp.status ?? 'active';

  const ctx = await getCurrentUserContext();
  if (!ctx) redirect('/login');

  if (ctx.profile.role === 'employee') redirect('/app');

  const restaurantId = await getEffectiveRestaurantId(ctx.profile);
  const admin = createSupabaseAdminClient();

  if (!restaurantId) {
    return (
      <main id="main-content" tabIndex={-1} className="app-shell stack rise-in">
        <h1 className="page-title">Equipo</h1>
        <Notice tone="error">
          No hay restaurante efectivo. Selecciona uno en el selector superior.
        </Notice>
      </main>
    );
  }

  const employees = await listEmployees(restaurantId, status);
  const avatarPaths = [
    ...new Set(
      employees.map((e) => e.avatar_path).filter((path): path is string => Boolean(path)),
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
  const canManage = canCreate(ctx.profile.role);

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
                          avatarUrl={
                            e.avatar_path
                              ? (avatarUrlByPath.get(e.avatar_path) ?? null)
                              : null
                          }
                          size="sm"
                        />
                        <span>{e.full_name || '(sin nombre)'}</span>
                      </div>
                    </td>
                    <td>{roleLabel(e.role)}</td>
                    <td>
                      <ButtonLink href={`/employees/${e.id}`} size="small" variant="secondary">
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
            employees.map((e) => (
              <article key={e.id} className="mobile-employee-card">
                <div className="mb-2 inline-flex items-center gap-2">
                  <UserAvatar
                    fullName={e.full_name}
                    role={e.role}
                    avatarUrl={
                      e.avatar_path ? (avatarUrlByPath.get(e.avatar_path) ?? null) : null
                    }
                    size="md"
                  />
                  <strong>{e.full_name || '(sin nombre)'}</strong>
                </div>

                <p className="text-xs muted">rol</p>
                <p>{roleLabel(e.role)}</p>

                <div className="form-actions mt-3">
                  <ButtonLink className="w-full" href={`/employees/${e.id}`} variant="secondary">
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
