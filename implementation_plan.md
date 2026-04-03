# Employee Management Scope Refactoring

This plan outlines the steps to complete the modernization of the employee management system, focusing on:
- Correct list projections for global scopes (Organization / Chain / Company)
- Clearer employee detail form layout (identity vs contractual data)
- UI polish: make the desktop `Scope` dropdown match the header link dropdowns style/animation

## Qué haré
1) Completar el soporte de proyecciones para vistas globales de empleados cuando el scope activo sea `Organization`, `Chain` o `Company`.
2) Refactorizar `EmployeeDetailForm` para separar visualmente datos de identidad vs datos contractuales.
3) Mejorar el dropdown de `Scope` en escritorio para que en estilo y animación asemeje a los dropdowns de links en el header.

## Cambios principales (archivos)
- `[web/src/modules/employees/application/buildEmployeesPageViewModel.ts](file:///c:/la-sentadita-hub/web/src/modules/employees/application/buildEmployeesPageViewModel.ts)`: mapear `frontendSession.activeScope` (`organization`/`chain`/`company`/`restaurant`) a la función de proyección correcta.
- `[web/src/shared/db/employment.ts](file:///c:/la-sentadita-hub/web/src/shared/db/employment.ts)`: re-exportar las proyecciones por scope para que el view model no importe el repo directamente.
- `[web/src/app/(authenticated)/employees/[id]/EmployeeDetailForm.tsx](file:///c:/la-sentadita-hub/web/src/app/(authenticated)/employees/[id]/EmployeeDetailForm.tsx)`: refactor de layout (manteniendo mismos campos y submits).
- `[web/src/shared/ui/Select.tsx](file:///c:/la-sentadita-hub/web/src/shared/ui/Select.tsx)` + `[web/src/app/globals.css](file:///c:/la-sentadita-hub/web/src/app/globals.css)` + `[web/src/app/components/scope-selector.tsx](file:///c:/la-sentadita-hub/web/src/app/components/scope-selector.tsx)` + `[web/src/app/components/app-header.tsx](file:///c:/la-sentadita-hub/web/src/app/components/app-header.tsx)`: añadir `dropdownVariant` y aplicar un variant “nav-like” solo en desktop para el selector de `Scope`.

## Flujo (visión global de empleados)
- El scope activo vive en `frontendSession.activeScope` (`scopeType`, `scopeId`).
- Cuando `effectiveRestaurantId` es `null` y el scope es global, se consulta:
  - `listEmploymentForOrganizationProjection`
  - `listEmploymentForChainProjection`
  - `listEmploymentForCompanyProjection`
- Luego se arma el `EmployeesListPageViewModel` con la lista resultante (y el filtro `inactive/all` debe reflejar el estado operativo).

## Verificación
- Ejecutar `pnpm run lint`.
- Ejecutar `pnpm run build`.
- Manual:
  - Cambiar scope desde el header y confirmar que la lista de empleados responde (incluyendo archivados según el filtro que corresponda).
  - Abrir/cerrar el dropdown de `Scope` y validar que su estilo y animación coinciden con los dropdowns del header en escritorio.
  - Entrar al detalle de un empleado y validar que el formulario se presenta con secciones “Datos de identidad” vs “Datos contractuales”.
