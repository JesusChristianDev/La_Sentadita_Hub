'use client';

import { useId, useState } from 'react';

import { Button, Modal } from '@/shared/ui';

type PendingAction = 'deactivate' | 'softDelete' | null;

type EmployeeDangerZoneActionsProps = {
  deactivateAction: (formData: FormData) => void | Promise<void>;
  isActive: boolean;
  reactivateAction: (formData: FormData) => void | Promise<void>;
  softDeleteAction: (formData: FormData) => void | Promise<void>;
};

type ConfirmationConfig = {
  body: string;
  confirmLabel: string;
  subtitle: string;
  title: string;
  variant: 'danger' | 'secondary';
};

function getConfirmationConfig(action: Exclude<PendingAction, null>): ConfirmationConfig {
  if (action === 'deactivate') {
    return {
      body: 'El empleado dejara de poder acceder hasta que lo reactives otra vez.',
      confirmLabel: 'Si, desactivar',
      subtitle: 'Es una accion reversible.',
      title: 'Desactivar empleado',
      variant: 'secondary',
    };
  }

  return {
    body: 'No es un borrado duro, pero tambien desactivara su acceso en Auth y lo sacara del flujo operativo habitual.',
    confirmLabel: 'Eliminar y desactivar Auth',
    subtitle: 'Afecta tanto al perfil interno como al acceso de autenticacion.',
    title: 'Eliminar empleado (soft)',
    variant: 'danger',
  };
}

export function EmployeeDangerZoneActions({
  deactivateAction,
  isActive,
  reactivateAction,
  softDeleteAction,
}: EmployeeDangerZoneActionsProps) {
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const titleId = useId();
  const confirmation = pendingAction ? getConfirmationConfig(pendingAction) : null;

  return (
    <>
      <div className="form-actions mt-3">
        {isActive ? (
          <Button
            onClick={() => setPendingAction('deactivate')}
            size="small"
            variant="secondary"
          >
            Desactivar
          </Button>
        ) : (
          <form action={reactivateAction}>
            <Button size="small" type="submit">
              Reactivar
            </Button>
          </form>
        )}

        <Button onClick={() => setPendingAction('softDelete')} size="small" variant="danger">
          Eliminar (soft)
        </Button>
      </div>

      <Modal
        actions={
          confirmation ? (
            <>
              <Button onClick={() => setPendingAction(null)} variant="secondary">
                Cancelar
              </Button>
              <form
                action={pendingAction === 'deactivate' ? deactivateAction : softDeleteAction}
              >
                <Button type="submit" variant={confirmation.variant}>
                  {confirmation.confirmLabel}
                </Button>
              </form>
            </>
          ) : null
        }
        onClose={() => setPendingAction(null)}
        open={pendingAction !== null}
        subtitle={confirmation?.subtitle}
        title={confirmation?.title ?? ''}
        titleId={titleId}
      >
        {confirmation ? <p>{confirmation.body}</p> : null}
      </Modal>
    </>
  );
}
