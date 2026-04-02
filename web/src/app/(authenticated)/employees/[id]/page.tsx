import { redirect } from 'next/navigation';

import { getCurrentUserContext } from '@/modules/auth_users';
import { buildEmployeeDetailPageViewModel } from '@/modules/employees/application/buildEmployeeDetailPageViewModel';
import {
  type EmployeeErrorCode,
  getEmployeeErrorMessage,
} from '@/shared/feedbackMessages';
import { ButtonLink, Notice } from '@/shared/ui';

import {
  deactivateEmployeeAction,
  reactivateEmployeeAction,
  softDeleteEmployeeAction,
  updateEmployeeAction,
} from './actions';
import { EmployeeDangerZoneActions } from './EmployeeDangerZoneActions';
import { EmployeeDetailForm } from './EmployeeDetailForm';

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

  const viewModel = await buildEmployeeDetailPageViewModel(ctx, id);

  if (viewModel.mode !== 'ready') {
    return (
      <main id="main-content" tabIndex={-1} className="app-shell stack rise-in">
        <h1 className="page-title">{viewModel.title}</h1>
        <Notice tone={viewModel.mode === 'not_found' ? 'error' : 'default'}>
          {viewModel.blockingReason}
        </Notice>
        <p className="text-sm">
          <ButtonLink href={viewModel.backHref} variant="secondary">
            Volver
          </ButtonLink>
        </p>
      </main>
    );
  }

  const errorMsg = getEmployeeErrorMessage(sp.e);
  const deactivateAction = deactivateEmployeeAction.bind(null, id);
  const reactivateAction = reactivateEmployeeAction.bind(null, id);
  const softDeleteAction = softDeleteEmployeeAction.bind(null, id);

  return (
    <main id="main-content" tabIndex={-1} className="app-shell stack rise-in">
      <section className="page-intro">
        <div>
          <h1 className="page-title">{viewModel.summary.title}</h1>
          <p className="subtitle">Ajusta datos personales, rol y estado operativo.</p>
        </div>
        <div className="page-intro-actions">
          <ButtonLink href={viewModel.backHref} variant="secondary">
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

        <EmployeeDetailForm
          submitAction={updateEmployeeAction.bind(null, id)}
          viewModel={viewModel}
        />
      </section>

      <section className="panel">
        <h2 className="panel-title">Estado</h2>
        <p className="panel-subtitle">
          Controla la disponibilidad del usuario en el sistema.
        </p>

        <p className="mt-2 text-sm muted">
          Estado:{' '}
          <span className="font-semibold">{viewModel.status.accessStatus}</span>
        </p>

        <EmployeeDangerZoneActions
          deactivateAction={deactivateAction}
          isActive={viewModel.status.isActive}
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
