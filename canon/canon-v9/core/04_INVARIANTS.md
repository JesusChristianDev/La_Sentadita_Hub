# 04 — Catálogo de Invariantes
## Reglas de negocio que el sistema debe garantizar siempre

---

## Regla de uso

Un invariante es una condición que el sistema garantiza en todo momento. Se implementan como:
- `CHECK` constraints en PostgreSQL
- Triggers en base de datos
- `assertCan()` + validación en capa de aplicación

Si una operación viola un invariante, lanza `InvariantViolationError` y no se ejecuta.

---

## BLOQUE I — Identidad y acceso

### I-001 — Un rol activo por persona
`Person` tiene exactamente 1 `system_role` activo en todo momento.
**Implementación:** NOT NULL constraint en `persons.system_role`

### I-002 — Un empleo activo por persona
Máximo 1 `EmploymentRelationship` activo simultáneamente por `Person`.
La semántica de negocio usa `valid_from` / `valid_to` inclusivos (`[]`). Los solapamientos se evalúan sobre `valid_during`, derivado técnicamente en `[)`.
**Implementación:** `EXCLUDE USING gist (person_id WITH =, valid_during WITH &&)` en `employment_relationships`, con `valid_during` generado desde `valid_from` / `valid_to`

### I-003 — Coherencia company/restaurante y solapamiento controlado
Todo `EmploymentRestaurantAssignment` debe apuntar a un `Restaurant` cuya `company_id` coincida con la `company_id` del `EmploymentRelationship`.
Además, `employee` y `area_lead` no pueden tener dos `EmploymentRestaurantAssignment` activas o solapadas en la misma fecha. `manager` sí puede tener varias.
**Implementación:** Trigger o validación en INSERT/UPDATE de `employment_restaurant_assignments` sobre `valid_during`, generado desde fechas inclusivas

### I-004 — area_lead requiere Zone activa única y coherente
Si `system_role = 'area_lead'`, debe existir exactamente 1 `EmploymentZoneAssignment` activa y exactamente 1 `RoleScopeAssignment` vigente con `scope_type = 'zone'`. Ambos deben apuntar a la misma `Zone`, y esa `Zone` debe pertenecer al `Restaurant` operativo activo.
**Implementación:** Trigger en asignaciones operativas + validación en capa de aplicación al asignar/cambiar `system_role`

### I-005 — manager requiere Restaurant activo
Si `system_role = 'manager'`, debe existir al menos 1 `RoleScopeAssignment` vigente con `scope_type = 'restaurant'`.
**Implementación:** Validación en capa de aplicación

### I-006 — Roles de alcance amplio requieren scope
`admin`, `owner` y `office` requieren al menos 1 `RoleScopeAssignment` vigente.
**Implementación:** Validación en capa de aplicación

### I-007 — Zone pertenece a Restaurant
`Zone` no puede existir sin `Restaurant`. Si se archiva un `Restaurant`, sus `Zone` se archivan en cascada.
**Implementación:** FK NOT NULL + trigger de cascada en archivado

### I-008 — employee no tiene RoleScopeAssignment
Si `system_role = 'employee'`, no puede existir ningún `RoleScopeAssignment` activo para esa persona.
**Implementación:** Validación en capa de aplicación al asignar/cambiar `system_role`

### I-009 — RoleScopeAssignment no redundante
No se permiten `RoleScopeAssignment` redundantes cubiertos por un scope superior vigente del mismo actor y rol dentro del mismo subárbol.
Sí se permiten varios scopes vigentes si ninguno cubre jerárquicamente al otro.
**Implementación:** Trigger en INSERT/UPDATE de `role_scope_assignments` + validación en capa de aplicación

---

## BLOQUE II — Schedule y turnos

### I-010 — No autoaprobación de swap
El empleado que propone un `ShiftSwapRequest` no puede ser el mismo que lo aprueba como manager.
**Implementación:** CHECK en trigger de aprobación

### I-011 — Compatibilidad de swap
Un `ShiftSwapRequest` solo puede aprobarse si ambos empleados comparten mismo restaurante, mismo `job_title` y mismo `responsibility_level`.
**Implementación:** Validación en capa de aplicación antes de aprobar

### I-012 — Schedule lock de concurrencia
Un `Schedule` con lock activo no puede ser modificado por nadie excepto quien tiene el lock o `manager`/`admin` con forzado explícito.
**Implementación:** Validación en capa de aplicación + `schedule_locks` con `expires_at`

### I-013 — No solapamiento de turnos
Un empleado no puede tener dos `ScheduleEntry` con fechas y horas solapadas en el mismo schedule.
**Implementación:** Validación en capa de aplicación al insertar/editar entries

### I-014 — ScheduleEntry solo en draft
Un `ScheduleEntry` solo puede crearse en un `Schedule` en estado `draft`.
**Implementación:** CHECK constraint o trigger

---

## BLOQUE III — Requests e incidentes

### I-020 — No autoaprobación de Request
Nadie puede aprobar su propia `Request`, independientemente del rol.
**Implementación:** Trigger en transición a `approved`

### I-021 — Aprobación de Request por tipo
- `vacation` y `sick_leave` → solo `office` o `admin`
- `justified_absence` y `absence` → `manager`, `office` o `admin`
**Implementación:** Validación en capa de aplicación en `approveRequest()`

### I-022 — Efecto de Request aprobada
Cuando una `Request` pasa a `approved` y bloquea fechas → el sistema sobrescribe el schedule automáticamente y las tareas afectadas pasan a `needs_reassignment`.
**Implementación:** Side effect en capa de aplicación post-aprobación

### I-023 — Incident siempre tiene restaurant
Un `Incident` no puede existir sin `restaurant_id`.
**Implementación:** NOT NULL FK constraint

### I-024 — Separación de funciones en DeliveryNote
La persona que sube un `DeliveryNote` no puede ser la misma que lo valida como `office`.
**Implementación:** CHECK en trigger de validación: `reviewed_by_office ≠ uploaded_by`

---

## BLOQUE IV — Datos y consistencia

### I-030 — Tarea siempre con responsable
Una `TaskInstance` no puede existir sin al menos un responsable operativo:
`assigned_employee_id` o `assigned_role` o `assigned_zone_id`.
**Implementación:** CHECK constraint o trigger de validación sobre `task_instances`

### I-031 — Soft delete universal
Ninguna entidad se elimina físicamente. Todo archivado usa `is_archived = true` + `deleted_at = NOW()`.
**Implementación:** Convención de código — ausencia de DELETE statements en capa de aplicación

### I-032 — AuditLog inmutable
Los registros de `AuditLog` no pueden ser modificados ni eliminados.
**Implementación:** RLS policy de solo INSERT + revocación de UPDATE/DELETE

### I-033 — Document no es raíz funcional
Un `Document` siempre tiene un owner y no puede existir huérfano.
**Implementación:** Validación en capa de aplicación al crear documentos

### I-034 — SupplierProductAlias requiere Supplier + Product
`SupplierProductAlias` siempre depende del par `Supplier + Product`.
**Implementación:** FK NOT NULL constraints en ambas columnas

---

## BLOQUE V — Vacaciones

### I-040 — days_available calculado
`vacation_entitlements.days_available` es columna generada. No puede modificarse directamente.
**Implementación:** GENERATED ALWAYS AS en PostgreSQL

### I-041 — No aprobar vacation sin saldo
No se puede aprobar una `Request` de tipo `vacation` si `days_available < días solicitados`.
**Implementación:** Validación en capa de aplicación en `approveRequest()`

### I-042 — adjustment_note obligatoria
Si `days_adjusted ≠ 0`, `adjustment_note` no puede ser null.
**Implementación:** CHECK constraint en `vacation_entitlements`

---

## BLOQUE VI — Fichaje

### I-050 — Geolocalización obligatoria en QR scan
Un fichaje con `source = 'qr_scan'` debe tener coordenadas GPS. Si la distancia supera `checkin_radius_meters`, el fichaje se rechaza.
**Implementación:** Validación en capa de aplicación antes de insertar `time_record`

### I-051 — QR token único por restaurante
Cada `Restaurant` tiene exactamente 1 `qr_token` único. Índice único en `restaurants.qr_token`.
**Implementación:** UNIQUE INDEX en `restaurants(qr_token)`

---

## BLOQUE VII — Seguridad y acceso

### I-060 — Backend decide permisos
La lógica de autorización vive exclusivamente en el backend. El frontend puede mostrar u ocultar UI pero nunca toma decisiones de acceso.
**Implementación:** Convención arquitectónica — toda acción pasa por `assertCan()`

### I-061 — RequestContext en toda operación
Toda operación de escritura debe construir un `RequestContext` válido con `personId`, `systemRole`, `traceId` y `activeScopeType` / `activeScopeId` opcionales. Si existe `active_scope`, debe quedar contenido dentro del árbol ya autorizado del actor o dentro de su asignación operativa vigente si `system_role = 'employee'`.
**Implementación:** Middleware de aplicación

### I-062 — Transiciones de access_status auditadas
Toda transición de `access_status` queda registrada en `AuditLog`.
**Implementación:** Side effect en capa de aplicación

---

## Resumen de implementación por capa

| Capa | Invariantes |
|---|---|
| PostgreSQL CHECK/FK | I-001, I-002, I-007, I-014, I-023, I-024, I-030, I-031, I-034, I-040, I-042, I-051 |
| PostgreSQL Triggers | I-003, I-004, I-007 (cascada), I-009, I-010, I-020, I-032 |
| Capa de aplicación | I-004, I-005, I-006, I-008, I-009, I-011, I-012, I-013, I-021, I-022, I-033, I-041, I-050, I-060, I-061, I-062 |
| RLS Supabase | I-032 (inmutabilidad AuditLog) |
