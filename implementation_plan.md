# Implementation Plan para La Sentadita Hub v8

## Visión General
El objetivo de este plan es adaptar y ejecutar la especificación "La Sentadita Hub Master Package v8" sobre el código actual en `web/src`.

Basado en el análisis de los documentos y el estado actual del repositorio, el sistema actual se encuentra en una etapa de transición entre la estructura antigua y la nueva (v8). Ya hay varios módulos creados en `src/modules/` pero difieren significativamente de la estructura oficial dictada en `PROJECT_STRUCTURE_v1.md`.

## Estado Actual vs Especificación v8

### 1. Estructura de Módulos (Domain / Application)
La especificación v8 requiere la siguiente estructura estricta en `src/modules/`:
- `authz` (Autorización)
- `audit` (Auditoría)
- `people` (Personas)
- `employment` (Empleo)
- `schedule` (Horarios)
- `tasks` (Tareas)
- `procedures` (Trámites)
- `shift-swaps` (Cambios de turno)
- `incidents` (Incidencias)
- `documents` (Documentos)
- `delivery-notes` (Albaranes - OCR)
- `notifications` (Notificaciones)
- `suppliers` (Proveedores)

**Estado actual:** Hay módulos que no se ajustan a v8 (ej. `auth_users`, `employees`, `area_leads`, `announcements`, `requests`).

### 2. Fuente de Verdad del Rol (Role Source of Truth Fix)
En v8, el modelo de datos se actualizó para que `person.system_role` sea la única fuente de verdad (eliminando `system_role` de `employment_relationship` y `role_scope_assignment`).
**Acción requerida:** Debemos refactorizar el código de `employees` y `auth_users` actual para que el rol se obtenga exclusivamente desde el contexto de la persona (módulo `authz` / `people`).

### 3. Fases de Implementación (IMPLEMENTATION_TICKETS_v1)
El orden obligatorio dictado por v8 es:
- [ ] **Fase 0 — Base**: Estructura proyecto, testing (Vitest), observabilidad (Sentry).
- [ ] **Fase 1 — AuthZ + Audit**: Implementar `deriveResponsibilityLevel`, `can()`, `assertCan()` e `insert_audit_log()`.
- [ ] **Fase 2 — People + Employment**: Separación entre identidad global (`people`) y relación contractual (`employment`).
- [ ] **Fase 3 — Scheduling**: Refactor de `schedule` eliminando validaciones antiguas e integrando el componente custom de Horario Semanal CSS Grid.
- [ ] **Fase 4 — Tasks**: Módulo de tareas.
- [ ] **Fase 5 — Procedures**: Reemplazar componentes sueltos como `requests` locales.
- [ ] **Fase 6 — Shift Swap**: Cambios de turno entre empleados.
- [ ] **Fase 7 — Incidents**: Sistema de incidencias.
- [ ] **Fase 8 — Documents**: Polimorfismo `documents.owner_id`.
- [ ] **Fase 9 — Notifications**: Patrón `notification_outbox`.
- [ ] **Fase 10 — Delivery Notes & Suppliers**: OCR con Mindee.

---

## 🎯 Plan de Acción Propuesto

Propongo ejecutar un refactor progresivo adaptando el código actual a v8, empezando por las fases iniciales para cimentar la base sólida exigida por la nueva arquitectura.

### Etapa 1: Reestructuración Base (Fase 0 & 1)
1. **Renombrar directorios**:
   - Renombrar `auth_users` -> `authz` y adaptar la estructura a `domain/` y `application/`.
   - Crear el módulo `audit` con `writeAuditLog.ts`.
2. **Implementar ACL robusto**:
   - Crear los tipos `RequestContext` tal como se definen en el documento de decisiones (`personId`, `systemRole`, `activeScopes`).
   - Mover lógica de obtención del rol para que siempre lea desde la identidad de la persona, respaldando la "Role Source of Truth Rule".
3. **Auditoría Base**:
   - Añadir Sentry (observabilidad estipulada en Fase 0).

### Etapa 2: Separación People / Employment (Fase 2)
1. Convertir el módulo actual `employees` en dos módulos distintos: `people` y `employment`.
2. Migrar la lógica de creación de relación laboral asegurando que no incluye el `system_role` (que debe pertenecer a `people`).

### Etapa 3: Scheduling (Fase 3)
1. Consolidar el módulo `schedule` actual.
2. Migrar los 7 servicios originales (Draft, Lock, Publication, Calculations, Dates, Validation) a la estructura `modules/schedule/application/`.
3. Validar el Invariante I3 (No solapamientos / un restaurante al día) en código (además de DB).

---

## User Review Required

> [!IMPORTANT]
> **Preguntas para el usuario:**
> 1. Actualmente existen módulos en el proyecto (`employees`, `hours_reports`, `requests`) que no están explícitamente en el "Project Structure v1" de v8. ¿Deseas que archivemos/eliminemos esos directorios para usar estrictamente los definidos en V8 (ej. separar `employees` en `people` y `employment`)?
> 2. V8 estipula Vitest y Playwright en `Fase 0`. `package.json` ya tiene los scripts. ¿Debo enfocarme en crear infraestructura de test básica antes de migrar los módulos?
> 3. ¿El esquema de Supabase ya ha sido actualizado con el archivo `01_schema.sql` (v6) que consolida `system_role` en `persons`?

## Verification Plan

### Automated Tests
- Ejecutar `npm run lint` y `npm run build` después de cada paso de reestructuración para asegurar que Next.js sigue compilando sin errores de types y rutas huérfanas.
- Validar las migraciones de módulos ejecutando `npm run test:unit`, asegurando de ajustar los imports de los tests.

### Manual Verification
- Validar que al iniciar sesión (vía navegador) el `RequestContext` recupera exitosamente el rol único desde un endpoint/server action, previniendo cuelgues.
