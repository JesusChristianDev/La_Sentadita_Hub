'use client';

import { useEffect } from 'react';
import { useState } from 'react';

import { Button, Select } from '@/shared/ui';

type Props = {
  restaurantId: string;
  restaurantZones: { id: string; name: string }[];
  canAssignManager: boolean;
  createEmployeeAction: (formData: FormData) => void;
};

export function NewEmployeeDrawer({
  restaurantId,
  restaurantZones,
  canAssignManager,
  createEmployeeAction,
}: Props) {
  const [open, setOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<
    'employee' | 'sub_manager' | 'manager'
  >('employee');

  const closeDrawer = () => {
    setOpen(false);
    setSelectedRole('employee');
  };

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
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
      <Button onClick={() => setOpen(true)}>
        Nuevo empleado
      </Button>

      {open ? (
        <div
          className="employee-drawer-backdrop"
          onClick={closeDrawer}
          role="presentation"
        >
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
              <Button onClick={closeDrawer} variant="secondary">
                Cerrar
              </Button>
            </header>

            <form action={createEmployeeAction} className="employee-drawer-form">
              <input type="hidden" name="restaurantId" value={restaurantId} />

              <label className="field">
                <span>Email</span>
                <input name="email" type="email" className="input" required />
              </label>

              <label className="field">
                <span>Nombre completo</span>
                <input name="fullName" className="input" required />
              </label>

              <label className="field">
                <span>Contrasena temporal</span>
                <input name="password" type="password" className="input" required />
              </label>

              <label className="field">
                <span>Rol</span>
                <Select
                  name="role"
                  value={selectedRole}
                  onChange={(event) => {
                    setSelectedRole(
                      event.target.value as 'employee' | 'sub_manager' | 'manager',
                    );
                  }}
                >
                  <option value="employee">Empleado</option>
                  <option value="sub_manager">Subgerente</option>
                  {canAssignManager ? <option value="manager">Gerente</option> : null}
                </Select>
              </label>

              {selectedRole === 'employee' ? (
                <>
                  <hr className="my-2 border-muted/20" />

                  <label className="field">
                    <span>Zona predeterminada</span>
                    <Select name="zoneId" defaultValue="">
                      <option value="">(Sin zona)</option>
                      {restaurantZones.map((z) => (
                        <option key={z.id} value={z.id}>
                          {z.name}
                        </option>
                      ))}
                    </Select>
                    <p className="text-2xs muted mt-1">
                      Categorias sugeridas: Cocina, Sala, Barra.
                    </p>
                  </label>

                  <div className="flex items-center gap-2 py-2">
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        name="isAreaLead"
                        value="1"
                        className="checkbox"
                      />
                      <span>Es encargado de zona</span>
                    </label>
                  </div>

                  <p className="text-xs muted mb-4">
                    El encargado de zona debe tener una zona predeterminada asignada para
                    aparecer correctamente en los horarios.
                  </p>
                </>
              ) : (
                <p className="text-sm muted my-4">
                  Los roles de gestión (Gerente/Subgerente) no requieren asignación de
                  zona ni pueden ser encargados de zona en los horarios operativos.
                </p>
              )}

              <Button className="w-full" type="submit">
                Crear empleado
              </Button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
