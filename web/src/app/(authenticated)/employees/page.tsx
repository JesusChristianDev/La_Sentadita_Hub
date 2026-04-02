import { redirect } from 'next/navigation';

import { getCurrentUserContext } from '@/modules/auth_users';
import { buildEmployeesPageViewModel } from '@/modules/employees/application/buildEmployeesPageViewModel';
import {
  type EmployeeErrorCode,
  type EmployeeStatusFilter,
  type EmployeeSuccessCode,
  getEmployeeErrorMessage,
  getEmployeeSuccessMessage,
} from '@/shared/feedbackMessages';
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

  const viewModel = await buildEmployeesPageViewModel(ctx, status);

  if (viewModel.mode === 'forbidden') {
    redirect('/app');
  }

  if (viewModel.mode === 'context_required') {
    return (
      <main id="main-content" tabIndex={-1} className="app-shell stack rise-in">
        <section className="page-intro">
          <div>
            <h1 className="page-title">Equipo</h1>
            <p className="subtitle">Gestion de usuarios operativos por restaurante.</p>
          </div>
        </section>

        <RestaurantContextEmptyState
          canPickRestaurant={viewModel.context.canChangeContext}
          moduleLabel="Equipo"
        />
      </main>
    );
  }

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
              <ChipLink active={status === 'inactive'} href="/employees?status=inactive">
                Inactivos
              </ChipLink>
              <ChipLink active={status === 'all'} href="/employees?status=all">
                Todos
              </ChipLink>
            </nav>
            {viewModel.createForm ? (
              <NewEmployeeDrawer
                allowedRoles={viewModel.createForm.allowedRoles}
                createEmployeeAction={createEmployeeAction}
                restaurantId={viewModel.createForm.restaurantId}
                restaurantZones={viewModel.createForm.zoneOptions}
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
              {viewModel.rows.length ? (
                viewModel.rows.map((employee) => (
                  <tr key={employee.id}>
                    <td>
                      <div className="inline-flex items-center gap-2">
                        <UserAvatar
                          fullName={employee.fullName}
                          role={null}
                          avatarUrl={employee.avatarUrl}
                          size="sm"
                        />
                        <span>{employee.fullName}</span>
                      </div>
                    </td>
                    <td>{employee.roleLabel}</td>
                    <td>
                      <ButtonLink href={employee.href} size="small" variant="secondary">
                        Editar
                      </ButtonLink>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="muted">
                    {viewModel.emptyState.description}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mobile-employee-list mt-3">
          {viewModel.rows.length ? (
            viewModel.rows.map((employee) => (
              <article key={employee.id} className="mobile-employee-card">
                <div className="mb-2 inline-flex items-center gap-2">
                  <UserAvatar
                    fullName={employee.fullName}
                    role={null}
                    avatarUrl={employee.avatarUrl}
                    size="md"
                  />
                  <strong>{employee.fullName}</strong>
                </div>

                <p className="text-xs muted">rol</p>
                <p>{employee.roleLabel}</p>

                <div className="form-actions mt-3">
                  <ButtonLink className="w-full" href={employee.href} variant="secondary">
                    Ver detalle
                  </ButtonLink>
                </div>
              </article>
            ))
          ) : (
            <p className="muted">{viewModel.emptyState.description}</p>
          )}
        </div>
      </section>
    </main>
  );
}
