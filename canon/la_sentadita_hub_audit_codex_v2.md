# La Sentadita Hub — auditoría técnica y plan de corrección para Codex

## Objetivo

Corregir el modelo de contexto para que `admin` / `owner` / `office` puedan operar correctamente en `organization`, `chain`, `company` y `restaurant` sin que la aplicación les fuerce a elegir una sucursal cuando el scope activo no es de restaurante.

El objetivo funcional no es solo “evitar el bloqueo por sucursal”. El objetivo real es este:

- el usuario debe poder **navegar de forma fácil entre todos los scopes que tiene permitidos**
- el **contexto activo del shell** debe reflejar ese scope
- el **contenido cargado por cada pantalla** debe adaptarse al scope activo
- cuando una operación concreta necesite restaurante y el scope activo no lo tenga resuelto, se debe pedir restaurante **solo para esa acción** o bajar a un sub-workspace de restaurante, pero no bloquear toda la pantalla por defecto

Además, dejar documentados los problemas principales de frontend y backend detectados en la revisión y proponer un plan de implementación seguro por fases.

---

## Resumen ejecutivo

El proyecto ya tiene un modelo de scopes rico en backend:

- `organization`
- `chain`
- `company`
- `restaurant`
- `zone`
- `self`

Ese modelo existe en:

- `web/src/modules/auth_users/domain/backendSession.ts`
- `web/src/modules/auth_users/infrastructure/backendSessionRepository.ts`
- `web/src/modules/authz/application/requestContext.ts`

El problema es que la app no está operando realmente sobre ese modelo. En la práctica, el shell y varias páginas siguen trabajando con un modelo reducido a:

- “hay restaurante efectivo”
- “no hay restaurante efectivo”

Eso produce tres fallos estructurales:

1. **La UI solo permite seleccionar restaurante**, no scope.
2. **Muchas páginas convierten `effectiveRestaurantId === null` en `context_required`**, aunque `activeScope` global o company sea completamente válido.
3. **El backend mezcla soporte real para scopes globales con servicios todavía restaurant-centric**, generando inconsistencia entre módulos.

### Aclaración funcional obligatoria para Codex

Esta implementación debe respetar estas reglas de producto:

1. **El usuario navega por scopes, no por sucursales.**
   - Si tiene `organization`, `company` y `restaurant`, debe poder cambiar entre ellos desde el shell sin fricción.
   - El selector principal del header debe ser de `scope`, no solo de restaurante.

2. **El contenido de cada módulo debe cargar según el scope activo.**
   - `organization` → vista agregada de organización
   - `company` → vista agregada de empresa
   - `restaurant` → workspace operativo de restaurante
   - `zone` → workspace o filtro de zona
   - `self` → vista personal

3. **No usar `effectiveRestaurantId === null` como sinónimo de contexto inválido.**
   - Solo significa que el scope actual no está amarrado a un restaurante concreto.

4. **Cuando una acción sí requiera restaurante**, resolverlo como acción puntual:
   - pedir restaurante en el formulario,
   - o abrir subflujo / subworkspace de restaurante,
   - pero no convertir toda la página en `context_required` si el scope activo ya es válido.

---

## Decisión de arquitectura recomendada

### Regla principal

`activeScope` debe convertirse en el eje primario de navegación y permisos en frontend.

`effectiveRestaurantId` debe pasar a ser:

- **derivado y obligatorio solo cuando la acción o el recurso es restaurant-bound**, o
- **nulo cuando el scope activo no es de restaurante/zona**.

### Regla secundaria

Un rol global (`admin`, `owner`, `office`) con scope activo `organization`, `chain` o `company` **no debe caer en `context_required` por defecto**.

Debe poder:

- ver dashboards agregados,
- ver listados agregados por scope,
- filtrar por restaurante dentro del módulo si necesita bajar de nivel,
- entrar a vistas restaurant-bound solo cuando el flujo lo requiera.

### Regla terciaria

`context_required` debe reservarse para una sola situación:

> La acción que intenta ejecutar el usuario necesita un restaurante concreto y la pantalla todavía no tiene uno resuelto.

No debe usarse como estado general para páginas enteras cuando el scope global es válido.

---

## Raíz del problema por archivo

### 1) `backendSessionRepository.ts`

Archivo:

- `web/src/modules/auth_users/infrastructure/backendSessionRepository.ts`

Problema:

Actualmente `effectiveRestaurantId` se resuelve así:

- si `activeScope.scopeType === 'restaurant'` → restaurante activo
- si `activeScope.scopeType === 'zone'` → restaurante de la zona
- en cualquier otro caso → restaurante actual de `currentEmployment`

Eso es incorrecto para roles globales.

#### Efecto

Un `admin` con scope activo `organization` o `company` no debería heredar automáticamente un restaurante operativo desde `currentEmployment`. Si lo hace:

- se contamina el contexto,
- se mezclan permisos globales con filtros de restaurante,
- y el frontend acaba usando `effectiveRestaurantId` como proxy de contexto cuando en realidad está en otra capa.

#### Cambio recomendado

Modificar la resolución de `effectiveRestaurantId` para que:

- `restaurant` → `scopeId`
- `zone` → restaurante de la zona
- `organization` / `chain` / `company` / `self` → `null`

Excepto si en el futuro se introduce un concepto explícito de “restaurant filter” secundario, separado del scope.

---

### 2) `requestContext.ts`

Archivo:

- `web/src/modules/authz/application/requestContext.ts`

Estado actual:

- `deriveActiveScopes()` ya contempla `organization` para roles globales.
- `buildRequestContextFromProfile()` recibe `effectiveRestaurantId`.

#### Evaluación

La base es razonable.

#### Cambio recomendado

No es necesario rehacer el archivo, pero sí garantizar que los consumidores no interpreten `effectiveRestaurantId` como sinónimo de “contexto válido”.

Opcionalmente, añadir helpers explícitos:

- `isGlobalScopeActive(ctx)`
- `isRestaurantScopeActive(ctx)`
- `requiresRestaurantResolution(action)`

para sacar esta lógica de las páginas.

---

### 3) `buildFrontendSessionView.ts`

Archivo:

- `web/src/modules/auth_users/application/buildFrontendSessionView.ts`

Problema:

El frontend ya recibe:

- `activeScope`
- `availableScopes`
- `effectiveRestaurantId`

Pero la UI sigue usando casi solo:

- `capabilities.context.canSelectRestaurant`
- `capabilities.context.hasEffectiveRestaurant`

#### Cambio recomendado

Ampliar el contrato frontend para que el shell trabaje con scopes de forma explícita:

- `canSelectScope`
- `availableScopes`
- `activeScope`
- `isRestaurantScoped`
- `isGlobalScoped`
- `requiresRestaurantForCurrentView` (opcional por página, no global)

Además:

- `canSelectRestaurant` no debe seguir siendo el control principal del contexto.
- debe existir `canSelectScope` como capability primaria del shell.

---

### 4) `app/actions.ts`

Archivo:

- `web/src/app/(authenticated)/app/actions.ts`

Problema:

Solo existe `setActiveRestaurant()`.

Eso obliga a que la navegación contextual sea únicamente por restaurante.

#### Cambio recomendado

Reemplazar o complementar con una nueva server action:

- `setActiveScope(formData)`

Inputs:

- `scopeType`
- `scopeId`
- opcional: `restaurantId` solo si el scope seleccionado necesita restaurante secundario en un flujo concreto

Comportamiento:

1. cargar `getCurrentUserContext()`
2. validar que el scope pedido existe en `ctx.backendSession.availableScopes`
3. persistir scope con `persistActiveScope()`
4. redirigir al referer seguro

`setActiveRestaurant()` debería quedarse como wrapper temporal o eliminarse después de migrar el header.

---

### 5) `activeScopeCookies.ts`

Archivo:

- `web/src/modules/auth_users/application/activeScopeCookies.ts`

Estado actual:

Este archivo ya soporta scope completo, no solo restaurante.

#### Evaluación

Está bien orientado.

#### Cambio recomendado

Mantenerlo y usarlo de verdad.

Posible mejora:

- deprecar gradualmente `ACTIVE_RESTAURANT_ID_COOKIE` como fuente primaria,
- dejarlo solo como compatibilidad temporal o “secondary selection” si luego se decide introducir filtro de restaurante dentro de scope global.

---

## Problema crítico de shell / navegación

### `app-header.tsx` y `authenticated/layout.tsx`

Archivos:

- `web/src/app/components/app-header.tsx`
- `web/src/app/(authenticated)/layout.tsx`
- `web/src/modules/auth_users/application/buildAuthenticatedShellViewModel.ts`

Problema:

El shell solo renderiza selector de restaurante:

- lista de restaurantes activos
- `Aplicar`

Pero el backend conoce scopes más ricos.

#### Cambio recomendado

Sustituir el selector de restaurante por un **selector de scope** para roles globales.

### Comportamiento objetivo

El shell debe comportarse como **scope navigator**.

#### Para `admin` / `owner` / `office`

Header debe permitir cambiar entre todos los scopes actualmente permitidos por `availableScopes`, por ejemplo:

- Organización
- Chain (si aplica)
- Company (si aplica)
- Restaurant
- Self (solo si se quiere mantener accesible)

El cambio de scope debe:

- persistir `activeScope`
- refrescar datos del layout y de la página actual
- recalcular navegación, KPIs, filtros y listados según el nuevo scope
- no arrastrar silenciosamente un restaurante heredado cuando el nuevo scope es global

#### Para `manager`

Seguir con scope de restaurante.

#### Para `area_lead`

Scope de zona + restaurante implícito.

#### Para `employee`

Sin selector global.

### Estructura sugerida del selector

- label visible: `Contexto activo`
- select o combobox con opciones `availableScopes`
- agrupación visual opcional por tipo: organización / empresa / restaurante / personal
- submit a `setActiveScope`
- cuando el scope sea `restaurant`, `activeScopeLabel` = nombre del restaurante
- cuando sea `company`, `activeScopeLabel` = nombre de la empresa
- cuando sea `organization`, `activeScopeLabel` = nombre real de la organización, no `Vista global`

Opcional recomendado:

- segundo selector o quick filter de restaurante **solo dentro de módulos agregados** donde haga falta drill-down, pero sin reemplazar al scope principal

---

## Páginas que hoy están mal modeladas respecto al contexto

### Regla transversal para todos los módulos

Cada módulo debe declarar explícitamente dos cosas:

1. **qué scopes puede renderizar**
2. **qué acciones dentro del módulo requieren restaurante concreto**

Ejemplo deseado:

- render global permitido, acción create restaurant-bound
- render company permitido, acción approve restaurant-bound
- render self permitido, sin necesidad de restaurante

No volver a modelar páginas con esta lógica implícita:

- `if (!effectiveRestaurantId) => context_required`

Eso solo vale para workspaces estrictamente restaurant-bound.

## 1) Dashboard

Archivo:

- `web/src/modules/dashboard/application/buildDashboardPageViewModel.ts`

Problema:

El dashboard cae en `context_required` si el usuario puede elegir restaurante pero no tiene `effectiveRestaurantId`.

Eso es incorrecto para roles globales con scope `organization/company/chain`.

#### Cambio recomendado

Nuevo comportamiento:

- `restaurant_scope` → dashboard de restaurante
- `company_scope` → dashboard agregado de compañía
- `organization_scope` → dashboard agregado de organización
- `self_scope` → dashboard personal

Eliminar la dependencia directa de `hasEffectiveRestaurant` como requisito para entrar.

---

## 2) Employees

Archivo:

- `web/src/modules/employees/application/buildEmployeesPageViewModel.ts`

Problema:

Hoy `!effectiveRestaurantId` => `context_required`.

Eso impide que `admin` u `office` vean empleados desde scope global/company.

#### Cambio recomendado

Refactorizar a modo por scope:

- `organization_overview`
- `company_overview`
- `restaurant_workspace`
- `forbidden`

### Nueva estrategia

En vez de `loadEmployeesPageProjection(restaurantId, status)`, crear algo como:

- `loadEmployeesByScopeProjection({ scopeType, scopeId, status })`

Capacidades:

- organization → empleados de toda la org
- company → empleados de esa empresa
- restaurant → empleados de ese restaurante

#### Alta de empleado

Crear empleado sí sigue siendo una operación restaurant-bound.

Por tanto:

- la página puede listar globalmente,
- pero el CTA “Nuevo empleado” debe pedir restaurante si el scope activo no es `restaurant`.

No bloquear toda la página por eso.

---

## 3) Schedule

Archivo:

- `web/src/modules/schedule/application/buildSchedulePageViewModel.ts`

Problema:

Hoy `!effectiveRestaurantId` => `context_required`.

Eso es razonable para abrir un editor de una semana concreta, pero no para toda la página de horarios cuando el usuario está en scope global.

#### Cambio recomendado

Separar claramente:

### `schedule_home` global/company

Mostrar:

- restaurantes visibles
- semana actual por restaurante
- borradores pendientes
- semanas publicadas recientes
- bloqueos activos
- accesos rápidos a “Abrir restaurante”

### `schedule_workspace` restaurant

Editor completo actual.

### Resultado

No bloquear `/horarios` para admin global.

Convertir `context_required` en `global_overview` para roles globales.

---

## 4) Tasks

Archivos:

- `web/src/modules/tasks/application/buildTasksPageViewModel.ts`
- `web/src/modules/tasks/application/taskService.ts`
- `web/src/modules/tasks/ui/TasksPageClient.tsx`
- `web/src/modules/tasks/ui/TaskCreateDialog.tsx`

Problemas:

1. `!effectiveRestaurantId` => `context_required`
2. `TaskCreateDialog` pide UUID manual de empleado
3. el botón `Gestionar` usa `alert(...)`
4. permisos de `area_lead` están desalineados entre ACL y backend

#### Cambios recomendados

### Contexto

- organization/company scope → lista agregada de tareas por restaurante
- restaurant scope → workspace actual
- self scope → tareas asignadas al usuario

### Backend

Alinear permisos:

- o permitir de verdad `area_lead` en los casos declarados por ACL,
- o quitar esa capacidad de la ACL y del view model

No dejar la contradicción actual.

### UX

- reemplazar UUID por select real de empleado / rol / zona
- implementar detalle/gestión real de tarea
- añadir filtros: restaurante, fecha, estado, responsable

---

## 5) Requests

Archivos:

- `web/src/modules/requests/application/buildRequestsPageViewModel.ts`
- `web/src/modules/requests/application/requestService.ts`
- `web/src/modules/requests/ui/RequestsPageClient.tsx`

Problemas:

1. `team_workspace` depende de `currentRestaurantId`
2. `context_required` bloquea bandeja de equipo en scope global/company
3. permisos de `area_lead` desalineados con backend
4. botón `Ver detalles` no implementado realmente

#### Cambios recomendados

- `myRequests` siempre visible
- `teamRequests` debe poder agregarse por scope activo
- si scope es organization/company, listar solicitudes agrupadas por restaurante
- si la revisión necesita manager/restaurant, esa restricción debe aplicarse al action concreto, no a toda la página

---

## 6) Incidents

Archivo:

- `web/src/modules/incidents/application/buildIncidentsPageViewModel.ts`

Problema:

`!currentRestaurantId` => `context_required`.

#### Cambio recomendado

- organization/company scope → bandeja agregada de incidencias
- create incident → si el scope actual no es restaurant, pedir restaurante en el formulario
- manage incident → aplicar permiso sobre el restaurante de la incidencia, no sobre el scope visible solamente

UX adicional:

- mostrar `zone_name`, no `zone_id`
- añadir filtros por restaurante, estado, severidad, categoría

---

## 7) Documents

Archivos:

- `web/src/modules/documents/application/buildDocumentsPageViewModel.ts`
- `web/src/modules/documents/application/documentService.ts`
- `web/src/modules/documents/ui/DocumentsPageClient.tsx`

Evaluación:

Es uno de los módulos mejor posicionados para scopes globales.

`documentService.ts` ya deja ver todos los documentos a roles globales.

#### Problemas restantes

- UI de creación sigue pidiendo `fileUrl` manual
- owner targets son demasiado limitados para organización/company

#### Cambios recomendados

- sustituir `fileUrl` por upload real a storage
- ampliar owner targets según scope activo
- si scope activo es organization/company, mostrar targets de ese nivel cuando el negocio lo permita

---

## 8) Procurement / Suppliers

Archivos:

- `web/src/modules/suppliers/application/buildSuppliersPageViewModel.ts`
- `web/src/modules/suppliers/application/internal.ts`
- `web/src/modules/suppliers/application/listSuppliers.ts`
- `web/src/modules/suppliers/ui/SuppliersPageClient.tsx`

Evaluación:

Este módulo ya apunta en la dirección correcta.

Tiene soporte real para:

- scope organization
- scope restaurant
- global overview para backoffice

#### Problemas

- `resolveOrganizationScopeId()` es más complicado de lo que debería ser
- el header general sigue sin dejar al usuario activar company/organization con claridad
- UX todavía tiene patrones de MVP (`prompt` para rechazo)

#### Cambios recomendados

- si `activeScope.scopeType === 'organization'`, usar ese scope directamente
- ampliar soporte a `company` si negocio lo requiere
- reemplazar `window.prompt()` por modal formal

---

## 9) Notifications

Archivo:

- `web/src/modules/notifications/ui/NotificationsPageClient.tsx`

Evaluación:

No depende del restaurante para existir. Está bien orientado como bandeja personal.

#### Problemas

- registro de push device demasiado técnico

#### Cambio recomendado

Automatizar registro con Web Push real desde navegador. No pedir endpoint/auth/p256dh manualmente al usuario.

---

## Inconsistencias de permisos detectadas

## `area_lead` en tareas y solicitudes

Archivo central:

- `web/src/modules/authz/application/aclRules.ts`

Problema:

ACL permite más de lo que luego permiten los services.

### Caso tareas

- ACL: `tasks.manage` permite global / manager / area_lead
- Service: usa `assertRestaurantManagement(...)`
- Resultado: el frontend cree que puede gestionar, el backend lo rechaza

### Caso solicitudes

- ACL: `requests.manage` incluye `area_lead`
- Service: revisión real usa `assertRestaurantManagement(...)`
- Resultado: misma inconsistencia

#### Decisión necesaria

Elegir una:

### Opción A

`area_lead` **sí** debe gestionar en su zona.

Entonces hay que:

- crear guards por zona en services,
- filtrar datasets por zona,
- validar targets por zona.

### Opción B

`area_lead` **no** debe gestionar esos módulos.

Entonces hay que:

- quitar `area_lead` de ACL para `tasks.manage` y `requests.manage`,
- ajustar view models.

No dejar estado mixto.

---

## Propuesta de implementación por fases

## Fase 1 — corregir arquitectura de contexto

### Objetivo

Dejar de forzar sucursal cuando el scope global es válido.

### Tareas

1. Corregir `effectiveRestaurantId` en `backendSessionRepository.ts`
2. Crear `setActiveScope()` en `app/actions.ts`
3. Reemplazar selector de restaurante por selector de scope en `app-header.tsx`
4. Expandir `buildAuthenticatedShellViewModel()` para exponer `availableScopes` completos
5. Introducir helpers de contexto en frontend:
   - `isGlobalScope`
   - `isRestaurantScope`
   - `isCompanyScope`
   - `isChainScope`
6. Cambiar dashboard para soportar `global_overview`

### Criterio de aceptación

- un `admin` con scope `organization` entra a `/app` sin elegir restaurante
- el header muestra `Organizacion` como contexto activo
- cambiar a un restaurante sigue funcionando
- cookies de scope siguen persistiendo correctamente

---

## Fase 2 — páginas críticas dependientes de restaurante

### Tareas

1. `Employees` → soportar vista por scope
2. `Requests` → soportar bandeja por scope
3. `Incidents` → soportar bandeja por scope
4. `Tasks` → soportar bandeja por scope
5. `Schedule` → crear `global_overview` para roles globales

### Criterio de aceptación

- ningún rol global cae en `context_required` por entrar a una página agregable
- solo las acciones concretas restaurant-bound piden restaurante

---

## Fase 3 — UX / producto

### Tareas

1. quitar UUID manual de tareas
2. quitar `alert()` / `prompt()`
3. implementar uploads reales de documentos
4. automatizar push device registration
5. añadir filtros por scope/restaurante en listados agregados

---

## Cambios concretos sugeridos por archivo

## A. Contexto / shell

### Editar

- `web/src/modules/auth_users/infrastructure/backendSessionRepository.ts`
- `web/src/modules/auth_users/application/buildFrontendSessionView.ts`
- `web/src/modules/auth_users/application/buildAuthenticatedShellViewModel.ts`
- `web/src/app/(authenticated)/app/actions.ts`
- `web/src/app/components/app-header.tsx`
- `web/src/app/(authenticated)/layout.tsx`

### Crear

- `web/src/modules/auth_users/application/resolveScopeUiState.ts`
- `web/src/app/components/scope-selector.tsx`

---

## B. Dashboard

### Editar

- `web/src/modules/dashboard/application/buildDashboardPageViewModel.ts`
- `web/src/app/(authenticated)/app/page.tsx`

---

## C. Employees

### Editar

- `web/src/modules/employees/application/buildEmployeesPageViewModel.ts`
- repositorio / loader de empleados por scope
- `web/src/app/(authenticated)/employees/page.tsx`

---

## D. Schedule

### Editar

- `web/src/modules/schedule/application/buildSchedulePageViewModel.ts`
- `web/src/app/(authenticated)/horarios/page.tsx`
- `loadScheduleHomeAction` y loaders para overview global

---

## E. Tasks

### Editar

- `web/src/modules/tasks/application/buildTasksPageViewModel.ts`
- `web/src/modules/tasks/application/taskService.ts`
- `web/src/modules/tasks/ui/TasksPageClient.tsx`
- `web/src/modules/tasks/ui/TaskCreateDialog.tsx`

---

## F. Requests

### Editar

- `web/src/modules/requests/application/buildRequestsPageViewModel.ts`
- `web/src/modules/requests/application/requestService.ts`
- `web/src/modules/requests/ui/RequestsPageClient.tsx`

---

## G. Incidents

### Editar

- `web/src/modules/incidents/application/buildIncidentsPageViewModel.ts`
- `web/src/modules/incidents/application/incidentService.ts`
- `web/src/modules/incidents/ui/IncidentsPageClient.tsx`

---

## H. Documents

### Editar

- `web/src/modules/documents/ui/DocumentsPageClient.tsx`
- `web/src/app/api/documents/route.ts`
- upload flow / storage integration

---

## I. Suppliers / procurement

### Editar

- `web/src/modules/suppliers/application/buildSuppliersPageViewModel.ts`
- `web/src/modules/suppliers/ui/SuppliersPageClient.tsx`

---

## Restricciones para Codex

1. No romper `area_lead`, `manager` ni `employee` existentes.
2. No introducir bypasses de permisos por simplificar la UI.
3. No usar `effectiveRestaurantId` como proxy universal de contexto.
4. No eliminar compatibilidad de cookies hasta cerrar migración.
5. Mantener `activeScope` como fuente primaria y `effectiveRestaurantId` como derivado secundario.

---

## Riesgos a vigilar

1. **Regresión de permisos** si el scope global termina viendo datos restaurant-bound sin filtro explícito.
2. **Queries demasiado pesadas** al agregar listados por organización.
3. **UX ambigua** si el usuario no distingue entre “scope activo” y “restaurante filtrado”.
4. **Deriva adicional** si se corrigen páginas sin corregir shell/contexto primero.

---

## Acceptance tests mínimos

### Admin

- puede entrar a `/app` con scope `organization` sin elegir sucursal
- puede cambiar a `company`
- puede cambiar a `restaurant`
- `Employees`, `Tasks`, `Requests`, `Incidents` no muestran `context_required` en scope global si la vista agregada existe
- `Schedule` muestra overview global y solo entra al editor al abrir un restaurante concreto

### Manager

- sigue entrando directo a workspace de su restaurante
- no gana scopes globales por accidente

### Area lead

- no ve permisos de gestión que luego el backend le niegue

### Employee

- no cambia nada esencial en su flujo actual

---

## Orden recomendado de PRs

1. **PR 1**: context core + shell + dashboard
2. **PR 2**: employees + requests + incidents + tasks (modes por scope)
3. **PR 3**: schedule global overview
4. **PR 4**: UX hardening (documents upload, prompt/alert cleanup, push automation)
5. **PR 5**: cleanup de deuda y tests de regresión

---

## Prompt base para Codex

```text
Necesito que corrijas la arquitectura de contexto de La Sentadita Hub.

Problema actual:
- El backend ya soporta scopes organization/chain/company/restaurant/zone/self.
- Pero el frontend sigue funcionando como si el contexto real fuera solo restaurante.
- Cuando admin/owner/office tienen scope organization o company, muchas pantallas caen en context_required porque effectiveRestaurantId es null.
- Eso es incorrecto: activeScope debe ser la fuente primaria del contexto y effectiveRestaurantId solo un derivado secundario para acciones restaurant-bound.

Objetivo:
1. Permitir que roles globales operen en organization/company/restaurant sin que la app les fuerce a elegir sucursal.
2. Reemplazar el selector actual de restaurante por selector de scope.
3. Convertir context_required en un estado reservado solo para acciones que realmente necesitan restaurante.
4. Soportar vistas agregadas por scope en dashboard, employees, requests, incidents y tasks.
5. Mantener permisos correctos y no introducir bypasses.

Cambios mínimos obligatorios:
- backendSessionRepository.ts: corregir derive/effectiveRestaurantId para scopes globales
- app/actions.ts: crear setActiveScope(formData)
- app-header.tsx: selector de scope
- buildFrontendSessionView.ts y buildAuthenticatedShellViewModel.ts: exponer availableScopes y estado de scope correctamente
- dashboard: dejar de depender de effectiveRestaurantId como requisito de entrada
- revisar y alinear inconsistencias de area_lead en tasks/requests

Reglas:
- activeScope es primario
- effectiveRestaurantId no se usa como proxy universal de contexto
- no romper manager/area_lead/employee
- mantener compatibilidad de cookies mientras migra la app

Entrega:
- cambios por fases y con código consistente
- si una pantalla sigue siendo restaurant-bound, que muestre un chooser inline o un flujo explícito, pero no bloquee toda la app global
```


## Criterios de aceptación obligatorios

1. Un `admin` con `activeScope = organization` puede entrar al dashboard y a módulos agregados sin selector previo de sucursal.
2. Un `admin` con `activeScope = company` ve contenido filtrado a esa empresa, no a toda la org ni a una sucursal heredada.
3. Un `admin` con `activeScope = restaurant` ve el workspace operativo de ese restaurante.
4. Cambiar el scope desde el header refresca la página y el contenido cambia de forma consistente.
5. Ningún módulo usa `effectiveRestaurantId === null` como error general si el scope activo es global válido.
6. Las acciones que sí necesitan restaurante piden restaurante solo en el punto de acción o cambian a sub-workspace explícito.
7. `availableScopes`, `activeScope` y `activeScopeLabel` son visibles y coherentes en el shell.
8. El header deja de ser “selector de sucursal” y pasa a ser “selector de contexto / scope”.

## Instrucción operativa para Codex

No implementar esto como parche local en una sola página.

El orden correcto es:

1. core de contexto (`backendSessionRepository`, `buildFrontendSessionView`, `requestContext`)
2. shell (`buildAuthenticatedShellViewModel`, `authenticated/layout`, `app-header`, `app/actions`)
3. dashboard
4. módulos agregables (`documents`, `suppliers`, `requests`, `tasks`, `incidents`, `employees`)
5. módulo más sensible: `schedule`, con `global_overview` separado del editor de restaurante

Si se invierte el orden, se duplicará lógica de contexto y habrá regresiones.
