# 12 — Frontend Blueprint
## Sesión, capacidades, navegación y modos de pantalla

---

## Principio rector

**Frontend guiado por backend, no por rol aislado.**

El frontend no decide permisos reales. El frontend:
- muestra navegación
- elige qué layout o empty state renderizar
- adapta copy y acciones visibles
- invoca acciones o endpoints del backend

La autorización sigue viviendo en backend y en RLS.

---

## Regla de modelado

Nunca construir UI con ramas del estilo:

```ts
if (role === 'manager') { ... }
if (role === 'office') { ... }
```

En La Sentadita Hub eso es insuficiente porque la vista efectiva depende de:
- `system_role`
- `active_scope`
- `RoleScopeAssignment` vigente
- `EmploymentRelationship` vigente
- asignaciones operativas vigentes
- restaurante efectivo derivado
- estado de acceso de la persona

Dos usuarios con el mismo rol no necesariamente ven lo mismo.

---

## Contrato base — `FrontendSessionView`

Toda pantalla autenticada debe partir de una proyección común derivada desde backend:

```ts
type FrontendSessionView = {
  person: {
    id: string
    fullName: string
    systemRole: SystemRole
    accessStatus: AccessStatus
  }
  activeScope: {
    scopeType: ScopeType
    scopeId: string | null
  }
  availableScopes: AvailableScope[]
  effectiveRestaurantId: string | null
  hasEffectiveRestaurant: boolean
  hasCurrentEmployment: boolean
  canPickRestaurant: boolean
  restaurants: VisibleRestaurant[]
  capabilities: FrontendCapabilities
}
```

### Objetivo

- evitar que cada página deduzca por su cuenta si puede entrar
- evitar defaults inseguros en navegación
- dar un lenguaje común para shell, dashboard y módulos

---

## Contrato de capacidades

El frontend consume capacidades explícitas, no recompone ACL.

```ts
type FrontendCapabilities = {
  restaurantContextSelect: boolean
  employeesView: boolean
  employeesCreate: boolean
  scheduleView: boolean
  scheduleEditDraft: boolean
  scheduleManageTemplates: boolean
  schedulePublish: boolean
  tasksView: boolean
  tasksManage: boolean
  requestsView: boolean
  requestsManage: boolean
}
```

### Regla

- las capacidades se calculan en una sola capa compartida
- los componentes cliente no llaman `can()` para tomar decisiones estructurales
- `can()` puede seguir existiendo en servidor, pero no repartido por todo el árbol UI

---

## Navegación

La navegación del shell debe derivarse únicamente de `FrontendSessionView.capabilities`.

### Reglas

- ningún item de navegación puede aparecer por default
- `tasks` y `requests` no pueden seguir visibles por omisión
- `active_scope` no cambia la autoridad, pero sí el foco de navegación y el copy contextual

### Contrato recomendado

```ts
type AppNavigationItem = {
  href: string
  label: string
  shortLabel: string
  mobileDescription: string
  icon: LucideIcon
}
```

`layout.tsx` construye la lista una sola vez y la inyecta en header, mobile drawer y dashboard.

---

## Modos de pantalla

Cada pantalla debe declarar un modo explícito antes de renderizar datos.

### Módulos con contexto de restaurante obligatorio

Aplican a:
- `employees`
- `horarios`
- `tasks`

Contrato:

```ts
type RestaurantScopedModuleMode =
  | 'forbidden'
  | 'context_required'
  | 'ready'
```

Reglas:
- `forbidden` → salir de la página o renderizar unauthorized
- `context_required` → mostrar `RestaurantContextEmptyState`
- `ready` → cargar datos reales

### Requests

`requests` no es puramente restaurant-scoped porque:
- la persona puede ver lo suyo sin gestionar equipo
- la gestión de equipo sí requiere restaurante efectivo

Contrato:

```ts
type RequestsModuleMode =
  | 'forbidden'
  | 'self_ready'
  | 'team_context_required'
  | 'team_ready'
```

Reglas:
- `self_ready` → ver y crear solicitudes propias
- `team_context_required` → ver lo propio y mostrar que la gestión de equipo necesita contexto
- `team_ready` → habilitar pestaña y acciones de equipo

---

## Reglas de composición UI

### 1. Páginas servidoras

Cada `page.tsx`:
- carga `FrontendSessionView`
- determina `pageMode`
- carga solo el dataset compatible con ese modo
- pasa un `PageViewModel` simple al cliente

### 2. Componentes cliente

Los componentes cliente:
- no deducen permisos globales
- no conocen RLS
- no conocen reglas de jerarquía
- reciben datos y acciones ya resueltas

### 3. Empty states

Los empty states se distinguen:
- `forbidden`
- `context_required`
- `no_data`
- `no_employment`

No mezclar “sin resultados” con “sin contexto”.

---

## Aplicación inicial por bloques

### Shell / Dashboard

- usar `FrontendSessionView`
- navegación única compartida
- cards de dashboard visibles solo por capacidad real

### Employees

- `RestaurantScopedModuleMode`
- listado y detalle alimentados desde backend
- edición condicionada por `employees.manage_target` en servidor

### Horarios

- `RestaurantScopedModuleMode`
- `schedule.view` para entrada
- edición/publicación visibles por capacidades, no por rol hardcodeado

### Tasks

- `RestaurantScopedModuleMode`
- acciones de gestión visibles por `tasksManage`

### Requests

- `RequestsModuleMode`
- vista propia siempre separada de la vista de equipo

---

## Antipatrones prohibidos

- defaults `true` en navegación o capacidades
- `TODO` de permisos en páginas principales
- `if role === ...` para decidir estructura de pantalla
- pedir a un componente cliente que deduzca si puede ver o mutar
- cargar datasets de equipo cuando aún no existe contexto de restaurante

---

## Done when

El frontend se considera alineado cuando:
- existe una única capa compartida de `FrontendSessionView`
- shell, dashboard, employees, horarios, tasks y requests la consumen
- no quedan defaults inseguros en navegación
- los modos `forbidden/context_required/ready` están explícitos por página
- el backend sigue siendo la única fuente de autoridad
