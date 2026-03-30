# 08 — Fases de Implementación
## Gates, fases, criterios de terminado y matriz ejecutable

---

## Principio rector

Construir en orden de dependencia. Nunca abrir una fase si la anterior no está cerrada según su criterio `done when`.

---

## Gates previos (antes de escribir código)

### G0 — Inventario real del repo
- **Objetivo:** confirmar el estado real de `src/`, SQL, tipos, rutas, helpers, ACL, aliases, naming legacy y compat temporal viva
- **Output:** lista verificable de módulos, acoplamientos, naming legacy, bridges y fuentes reales de verdad
- **Done when:** existe inventario confirmado de lo que sigue vivo en código y SQL. No quedan supuestos estructurales

### G1 — Mapa legacy → canon
- **Objetivo:** traducir cada término, carpeta, flujo o contrato legacy a su destino canónico
- **Output:** matriz `legacy → replacement → bloque → orden → retiro`
- **Done when:** cada término legacy tiene replacement canónico, motivo y fase asignada

---

## Fases de implementación

### FASE 0 — Base del proyecto
**Objetivo:** estructura, tooling, testing y observabilidad antes de cualquier lógica de negocio

**Entregables:**
- Estructura de carpetas según `06_PROJECT_STRUCTURE.md`
- Configuración de TypeScript estricto
- Configuración de Vitest + Testing Library + Playwright
- Configuración de Sentry
- Variables de entorno validadas con @t3-oss/env-nextjs + Zod
- Conexión a Supabase verificada (cliente browser + server)
- Husky + lint-staged configurado
- `shared/authz/` con tipos base: `SystemRoleEnum`, `ScopeTypeEnum`, `RequestContext`
- `shared/types/errors.ts` con los 5 tipos de error canónicos
- CI básico (build + tests en PR)

**Done when:** el proyecto arranca, los tests corren, el lint pasa y la conexión a Supabase funciona.

---

### FASE 1 — SQL Schema
**Objetivo:** base de datos lista y alineada con el canon v9

**Entregables:**
- Schema SQL completo con naming canónico (sin `sub_manager`, sin `chain_owner`, sin `platform` scope)
- Enums: `system_role_enum`, `access_status_enum`, `scope_type_enum`, `request_type_enum`, `incident_category_enum`, `incident_sensitivity_enum`, `schedule_status_enum`, `request_status_enum`
- Tablas: todas las entidades canónicas de `02_DOMAIN_MODEL.md`
- Triggers: `set_updated_at`, invariante I-003, invariante I-020, invariante I-024, inmutabilidad AuditLog
- Índices: partial unique en `employment_relationships` (I-002), índices de performance en FKs críticas
- RLS base: política de servicio para operaciones backend
- Funciones SQL: `current_person_id()`, `current_system_role()`
- Seed de referencia con datos mínimos para desarrollo

**Done when:** schema desplegado en Supabase, triggers funcionando, seed ejecutado sin errores.

---

### FASE 2 — AuthZ + Audit
**Objetivo:** autorización y auditoría operativas antes de cualquier módulo de negocio

**Entregables:**
- `shared/authz/can.ts` → `can(ctx, action, resource): Promise<boolean>`
- `shared/authz/assertCan.ts` → `assertCan(ctx, action, resource): Promise<void>`
- `shared/authz/responsibilityLevel.ts` → `deriveResponsibilityLevel()`
- `modules/audit/application/writeAuditLog.ts`
- Tests de `can()` por rol y acción para los módulos críticos
- Tests de `deriveResponsibilityLevel()`

**Done when:** `can()` y `assertCan()` cubren todos los roles y acciones de `03_ACL_MATRIX.md`. `writeAuditLog()` inserta correctamente. Tests de authz pasan.

---

### FASE 3 — People + Employment
**Objetivo:** gestión de personas y vínculos laborales

**Entregables:**
- `modules/people/`: createPerson, updatePersonIdentity, archivePerson, changeAccessStatus
- `modules/employment/`: createEmploymentRelationship, updateEmployment, terminateEmployment
- Validación de invariantes I-001, I-002, I-003 en capa de aplicación
- Validación de invariantes I-004, I-005, I-006 al cambiar system_role
- Tests: createPerson, changeAccessStatus (transiciones), employeeMutationRules
- UI básica: listado de personas, formulario de alta, cambio de estado

**Done when:** se puede crear una persona, asignarle empleo, cambiar su access_status y todo queda auditado. Tests de invariantes pasan.

---

### FASE 4 — Restaurants (estructura organizativa)
**Objetivo:** gestión de la estructura Chain → Company → Restaurant → Zone

**Entregables:**
- `modules/restaurants/`: createRestaurant, archiveRestaurant, createZone, archiveZone
- Validación de archivado por rol (D-061)
- Cascada de archivado Zone al archivar Restaurant (I-007)
- Tests: archivado con cascada, permisos por rol

**Done when:** se puede crear y archivar toda la estructura organizativa. Cascadas funcionan. Tests pasan.

---

### FASE 5 — Scheduling
**Objetivo:** el módulo más complejo — horarios semanales, templates y lock

**Entregables:**
- Draft: crear, editar, publicar schedule
- ScheduleEntry: añadir, editar, eliminar turnos
- ShiftTemplate: crear, editar, archivar, aplicar a draft
- CopyPreviousWeek: operación del scheduleDraftService
- Lock: scheduleLockService con expiración por Vercel Cron Job
- Validación de no solapamientos (I-013)
- Tests: todos los archivos `__tests__/` del módulo schedule

**Done when:** manager puede construir, publicar y bloquear un horario. Templates funcionan. Copiar semana anterior funciona. Lock expira automáticamente. Tests pasan.

---

### FASE 6 — Tasks
**Objetivo:** gestión de tareas operativas

**Entregables:**
- `modules/tasks/`: createTask, completeTask, reassignTask
- Validación de invariante I-030 (tarea siempre con responsable)
- Efecto de Request aprobada sobre tasks (I-022): tareas pasan a `needs_reassignment`

**Done when:** se pueden crear, completar y reasignar tareas. Invariante de responsable funciona. Tests pasan.

---

### FASE 7 — Requests + ShiftSwaps
**Objetivo:** solicitudes laborales e intercambios de turno

**Entregables:**
- `modules/requests/`: createRequest, approveRequest, rejectRequest, cancelRequest, applyRequestToSchedule
- `modules/shift-swaps/`: proposeShiftSwap, respondToShiftSwap, approveShiftSwap
- Invariante I-020 (no autoaprobación) en ambos módulos
- Invariante I-021 (aprobación por tipo)
- Efecto de Request aprobada sobre Schedule (I-022)
- Efecto de ShiftSwap aprobado sobre Schedule

**Done when:** flujo completo de vacaciones funciona (create → approve → schedule actualizado). Flujo de swap funciona (propose → respond → approve → schedule actualizado). Tests de invariantes pasan.

---

### FASE 8 — Incidents
**Objetivo:** registro y gestión de incidencias operativas

**Entregables:**
- `modules/incidents/`: createIncident, routeIncident, reviewIncident, resolveIncident, closeIncident
- Enrutamiento automático por categoría con notificación al responsable
- Restricción de visibilidad `restricted` (I-008, I-009 del ZIP)

**Done when:** cualquier empleado puede crear un incidente, el sistema lo enruta al responsable correcto y el flujo completo hasta `closed` funciona. Tests pasan.

---

### FASE 9 — Delivery Notes
**Objetivo:** recepción y validación de albaranes con OCR

**Entregables:**
- `modules/delivery-notes/`: uploadDeliveryNote, extractWithOCR, confirmExtraction, validateDeliveryNote
- Integración con Mindee API
- Separación de funciones: invariante I-024
- Supplier + Product + SupplierProductAlias como auxiliares

**Done when:** flujo completo de albarán funciona (subir → OCR → confirmar → office valida). Separación de funciones funciona. Tests pasan.

---

### FASE 10 — Documents + Notifications
**Objetivo:** soporte documental transversal y notificaciones

**Entregables:**
- `modules/documents/`: uploadDocument, archiveDocument
- `modules/notifications/`: sendNotification, markAsRead
- Canales predeterminados por evento según `09_NOTIFICATION_CATALOG.md`
- Push notifications con web-push
- Email notifications con Resend + @react-email

**Done when:** documentos se pueden adjuntar a otros módulos. Notificaciones llegan por el canal correcto según tipo de evento. Tests pasan.

---

## Matriz ejecutable

| Fase | Estado | Bloquea a | Riesgo dominante | Done when |
|---|---|---|---|---|
| G0 — Inventario | `pending` | Todo | Creer que el código coincide con la doc | Lista verificable de legacy vivo |
| G1 — Mapa legacy | `pending` | F0–F10 | Renombrar sin destino claro | Cada legacy tiene replacement y fase |
| F0 — Base | `pending` | F1–F10 | Tooling roto desde el inicio | Proyecto arranca, tests corren |
| F1 — SQL Schema | `pending` | F2–F10 | Schema con naming legacy | Schema desplegado, triggers activos |
| F2 — AuthZ + Audit | `pending` | F3–F10 | Autorización incorrecta en producción | `can()` cubre toda la ACL matrix |
| F3 — People + Employment | `pending` | F4–F10 | Lifecycle de acceso incompleto | Alta de persona + empleo + audit |
| F4 — Restaurants | `pending` | F5–F10 | Cascadas de archivado rotas | Estructura completa + cascadas |
| F5 — Scheduling | `pending` | F6–F10 | Solapamientos, lock sin expiración | Draft + publish + lock + templates |
| F6 — Tasks | `pending` | F7–F10 | Tarea sin responsable | create + complete + reassign |
| F7 — Requests + Swaps | `pending` | F8–F10 | Autoaprobación, efecto en schedule | Flujos completos + schedule actualizado |
| F8 — Incidents | `pending` | F9–F10 | Enrutamiento incorrecto | Flujo completo + enrutamiento |
| F9 — Delivery Notes | `pending` | F10 | OCR como fuente de verdad | Flujo completo + separación funciones |
| F10 — Docs + Notifs | `pending` | — | Notificaciones silenciosas | Canales por evento funcionando |

---

## Estados del tablero

`pending` → `in_progress` → `blocked` → `done`

**Reglas:**
- Una fase no pasa a `done` si quedan tests en rojo
- Una fase no pasa a `in_progress` si su dependencia sigue en `pending`
- Si aparece contradicción de canon durante una fase → `blocked` hasta resolver
- Cada fase debe producir entregable verificable antes de declararse avanzada

---

## Test matrix mínima por fase

| Módulo | Tests obligatorios antes de `done` |
|---|---|
| AuthZ | `can()` por rol × acción × recurso. `deriveResponsibilityLevel()` |
| People | createPerson, changeAccessStatus (todas las transiciones), archivePerson |
| Employment | createEmploymentRelationship, invariante I-002, invariante I-003 |
| Schedule | no solapamientos, lock/unlock, publish, copyPreviousWeek, shiftTemplate |
| Requests | approveRequest (invariante I-020), aprobación por tipo (I-021), efecto en schedule |
| ShiftSwap | flujo completo, compatibilidad (I-011), efecto en schedule |
| Incidents | enrutamiento por categoría, visibilidad restricted |
| DeliveryNotes | separación de funciones (I-024), flujo completo |
