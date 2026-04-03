'use client';

import { useMemo, useState } from 'react';

import type { EmployeeDetailPageViewModel } from '@/modules/employees/application/buildEmployeeDetailPageViewModel';
import { Button, Select } from '@/shared/ui';

type ReadyViewModel = Extract<EmployeeDetailPageViewModel, { mode: 'ready' }>;

type Props = {
  submitAction: (formData: FormData) => void;
  viewModel: ReadyViewModel;
};

export function EmployeeDetailForm({ submitAction, viewModel }: Props) {
  const [selectedRole, setSelectedRole] = useState(viewModel.form.selectedRole);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState(
    viewModel.form.selectedRestaurantId,
  );

  const zoneOptions = useMemo(
    () => viewModel.form.zoneOptionsByRestaurant[selectedRestaurantId] ?? [],
    [selectedRestaurantId, viewModel.form.zoneOptionsByRestaurant],
  );
  const shouldShowZoneAssignment =
    selectedRole === 'employee' || selectedRole === 'area_lead';

  return (
    <form action={submitAction} className="mt-3 grid gap-3">
      <h3 className="text-sm font-semibold text-foreground">Datos de identidad</h3>

      <label className="field">
        <span>Email (Auth)</span>
        <input defaultValue={viewModel.form.email} name="email" className="input" />
      </label>

      <label className="field">
        <span>Nueva contrasena (opcional)</span>
        <input name="password" type="password" className="input" />
      </label>

      <label className="field">
        <span>Nombre completo</span>
        <input
          defaultValue={viewModel.form.fullName}
          name="fullName"
          className="input"
        />
      </label>

      <h3 className="mt-1 text-sm font-semibold text-foreground">Datos contractuales</h3>

      {viewModel.form.fieldLocks.role ? (
        <label className="field">
          <span>Rol</span>
          <input type="hidden" name="role" value={selectedRole} />
          <input
            className="input"
            value={viewModel.form.roleOptions[0]?.label ?? ''}
            readOnly
          />
        </label>
      ) : (
        <label className="field">
          <span>Rol</span>
          <Select
            defaultValue={selectedRole}
            name="role"
            onChange={(event) => setSelectedRole(event.target.value as typeof selectedRole)}
          >
            {viewModel.form.roleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </label>
      )}

      {viewModel.form.fieldLocks.restaurant ? (
        <label className="field">
          <span>Restaurante</span>
          <input type="hidden" name="restaurantId" value={selectedRestaurantId} />
          <input
            className="input"
            value={
              viewModel.form.restaurantOptions.find(
                (restaurant) => restaurant.id === selectedRestaurantId,
              )?.name ?? '(sin restaurante)'
            }
            readOnly
          />
        </label>
      ) : (
        <label className="field">
          <span>Restaurante</span>
          <Select
            defaultValue={selectedRestaurantId}
            name="restaurantId"
            onChange={(event) => setSelectedRestaurantId(event.target.value)}
          >
            <option value="" disabled>
              Selecciona...
            </option>
            {viewModel.form.restaurantOptions.map((restaurant) => (
              <option key={restaurant.id} value={restaurant.id}>
                {restaurant.name}
              </option>
            ))}
          </Select>
        </label>
      )}

      <hr className="my-2 border-muted/20" />

      {shouldShowZoneAssignment ? (
        <label className="field">
          <span>Zona predeterminada</span>
          <Select name="zoneId" defaultValue={viewModel.form.selectedZoneId ?? ''}>
            <option value="">(Sin zona)</option>
            {zoneOptions.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-2xs muted">
            {selectedRole === 'area_lead'
              ? 'Encargado de zona requiere una zona predeterminada.'
              : 'Empleado sin zona quedara como no asignado en horarios.'}
          </p>
        </label>
      ) : (
        <p className="py-2 text-sm muted">
          Los roles de gestion no requieren zona asignada.
        </p>
      )}

      <Button className="mt-2" type="submit">
        Guardar cambios
      </Button>
    </form>
  );
}
