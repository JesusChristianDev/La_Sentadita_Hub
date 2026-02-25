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
  const [assignAreaLead, setAssignAreaLead] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'employee' | 'sub_manager' | 'manager'>(
    'employee',
  );

  const closeDrawer = () => {
    setOpen(false);
    setAssignAreaLead(false);
    setSelectedRole('employee');
  };

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        setAssignAreaLead(false);
        setSelectedRole('employee');
      }
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
        <div className="employee-drawer-backdrop" onClick={closeDrawer} role="presentation">
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
                onClick={closeDrawer}
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
                <select
                  name="role"
                  className="select"
                  value={selectedRole}
                  onChange={(event) => {
                    const nextRole = event.target.value as
                      | 'employee'
                      | 'sub_manager'
                      | 'manager';
                    setSelectedRole(nextRole);
                    if (nextRole !== 'employee') setAssignAreaLead(false);
                  }}
                >
                  <option value="employee">Empleado</option>
                  <option value="sub_manager">Subgerente</option>
                  {canAssignManager ? <option value="manager">Gerente</option> : null}
                </select>
              </label>

              {selectedRole === 'employee' ? (
                <>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="assignAreaLead"
                      value="1"
                      checked={assignAreaLead}
                      onChange={(event) => setAssignAreaLead(event.target.checked)}
                    />
                    <span>Asignar como encargado de zona</span>
                  </label>

                  {assignAreaLead ? (
                    <label className="field">
                      <span>Zona</span>
                      <select name="zone" className="select" defaultValue="kitchen">
                        <option value="kitchen">Cocina</option>
                        <option value="floor">Sala</option>
                        <option value="bar">Barra</option>
                      </select>
                    </label>
                  ) : null}
                </>
              ) : (
                <p className="text-xs muted">
                  Solo rol Empleado puede ser encargado de zona.
                </p>
              )}

              {assignAreaLead && selectedRole === 'employee' ? (
                <p className="text-xs muted">
                  El cupo se asigna automaticamente en la zona seleccionada.
                </p>
              ) : null}

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
