'use client';

import { useEffect } from 'react';
import { useState } from 'react';

type Props = {
  restaurantId: string;
  canAssignManager: boolean;
  createEmployeeAction: (formData: FormData) => void;
};

export function NewEmployeeDrawer({
  restaurantId,
  canAssignManager,
  createEmployeeAction,
}: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <>
      <button className="button" type="button" onClick={() => setOpen(true)}>
        Nuevo empleado
      </button>

      {open ? (
        <div className="employee-drawer-backdrop" onClick={() => setOpen(false)} role="presentation">
          <div
            className="employee-drawer-panel"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Crear empleado"
          >
            <header className="employee-drawer-header">
              <div>
                <h2 className="panel-title">Nuevo empleado</h2>
                <p className="mt-2 text-sm muted">
                  Usuario activo con cambio de contrasena obligatorio.
                </p>
              </div>
              <button
                className="button secondary"
                type="button"
                onClick={() => setOpen(false)}
              >
                Cerrar
              </button>
            </header>

            <form action={createEmployeeAction} className="employee-drawer-form">
              <input type="hidden" name="restaurantId" value={restaurantId} />

              <label className="field">
                <span>Email</span>
                <input name="email" type="email" className="input" />
              </label>

              <label className="field">
                <span>Nombre completo</span>
                <input name="fullName" className="input" />
              </label>

              <label className="field">
                <span>Contrasena temporal</span>
                <input name="password" type="password" className="input" />
              </label>

              <label className="field">
                <span>Rol</span>
                <select name="role" className="select" defaultValue="employee">
                  <option value="employee">Empleado</option>
                  <option value="sub_manager">Subgerente</option>
                  {canAssignManager ? <option value="manager">Gerente</option> : null}
                </select>
              </label>

              <button className="button w-full" type="submit">
                Crear empleado
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
