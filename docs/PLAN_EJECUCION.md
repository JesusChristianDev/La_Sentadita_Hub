# Plan de Ejecución — La Sentadita Hub
## Estado real → Lanzamiento producción

**Fecha:** Mayo 2026  
**Basado en:** Canon v9 · Fases G0–F10 · Convergencia Supabase completada

---

## Situación de partida

El proyecto completó la convergencia de base de datos (v8 → canon v9, 23 migraciones) y tiene
scaffolding funcional en todos los módulos operativos. El trabajo pendiente se distribuye en:

1. **Tres transiciones activas** que deben cerrarse antes de avanzar en features nuevas
2. **Fases del canon** que están en scaffolding pero no en estado `done`
3. **Gaps de seguridad puntuales** que no forman parte de ninguna fase

El criterio de avance es el mismo que marca el canon: una fase no pasa a `done` si quedan tests
en rojo o invariantes sin cubrir.

---

## BLOQUE 0 — Cerrar antes de todo lo demás

> Estos tres items no son fases del canon. Son deuda real que bloquea el trabajo limpio.
> Tiempo estimado: 1–2 días.

### B0.1 — Tres gaps de seguridad

| # | Problema | Archivo | Fix |
|---|----------|---------|-----|
| 1 | Scope cookie sin `maxAge` → persiste para siempre | `activeScopeCookies.ts:26` | Añadir `maxAge: 3600` |
| 2 | CSRF ausente en API routes POST | `/api/me/active-scope/route.ts` y resto de POSTs | Validar header `Origin` contra `NEXT_PUBLIC_APP_URL` |
| 3 | `effectiveRestaurantId` leído de cookie sin validar contra `visibleRestaurants` | `backendSessionRepository.ts:688` | Cross-check antes de devolver el valor |

**Done when:** los tres cambios tienen test o validación manual confirmada. No producen regresión en login ni cambio de scope.

### B0.2 — Transaccionalidad en `saveCellDraft`

El audit trail puede quedar corrupto si `insertScheduleEntryLog()` falla después de `updateEntry()`.

**Fix:** envolver `persistDraftEntry` en una unidad atómica. Si no hay soporte de transacciones
explícitas en el cliente actual, usar `supabase.rpc('persist_draft_entry_atomic')` como función
`SECURITY DEFINER` que haga ambas operaciones.

**Done when:** test unitario verifica que si falla el log, la entry no queda actualizada (o viceversa).

### B0.3 — RLS gaps críticos de base de datos

| Tabla | Gap | Fix |
|-------|-----|-----|
| `employment_relationships` | Admin sin política SELECT después de mig 021 | Migración 024: `employment_relationships_admin_select` |
| `notification_outbox` | Solo tiene SELECT — falta INSERT/UPDATE/DELETE | Añadir las tres políticas con `employee_id = current_person_id()` |

**Done when:** migración 024 aplicada, query de admin sobre `employment_relationships` devuelve datos.

---

## FASE A — Completar la transición activa de Employees

> **Esta es la tarea en curso del `implementation_plan.md`.** Completarla antes de abrir cualquier
> fase nueva. Estado: en progreso.

### A.1 — Projecciones globales en el listado de empleados

`buildEmployeesPageViewModel.ts` hoy cae en `context_required` cuando `effectiveRestaurantId`
es null. Debe mostrar vista agregada cuando `activeScope` es `organization`, `chain` o `company`.

**Entregables:**
- `listEmploymentForOrganizationProjection()` en `shared/db/employment.ts` — re-export limpio
- `listEmploymentForChainProjection()` — ídem
- `listEmploymentForCompanyProjection()` — ídem
- `buildEmployeesPageViewModel` resuelve la proyección correcta según `activeScope.scopeType`
- Filtro "activos / todos" funciona en las tres vistas globales

### A.2 — Refactor `EmployeeDetailForm`

Separar visualmente "Datos de identidad" (nombre, email, teléfono, DNI) de "Datos contractuales"
(rol, restaurante, zona, contrato). Mismos campos, mismo submit, nuevo layout.

### A.3 — Scope dropdown en desktop

El selector del header en desktop debe usar el mismo estilo y animación que los dropdowns de
navegación. Afecta `scope-selector.tsx`, `app-header.tsx` y `globals.css`.

**Done when (Fase A):**
- `pnpm lint` pasa
- `pnpm build` pasa
- Manual: cambiar scope a Organization → lista de empleados carga sin `context_required`
- Manual: dropdown de scope tiene estilo coherente con el resto del header

---

## FASE B — Estabilizar el núcleo de People + Employment (F3 canon)

> Una vez cerrada la transición activa (Fase A), consolidar F3 según el test matrix del canon.

### B.1 — Tests obligatorios de People

```
createPerson (happy path + email duplicado)
changeAccessStatus (todas las transiciones de D-028)
archivePerson (soft delete, reversible solo por admin)
selfProfileMutationRules (ya existe — revisar cobertura)
```

### B.2 — Tests obligatorios de Employment

```
createEmploymentRelationship (happy path + rollback si falla projection)
updateEmployment (validación restaurant ≠ archived)
terminateEmployment (valid_to set, access_status → archived)
setEmploymentActive (reactivación desde seed)
invariante I-002 (un solo empleo activo por persona)
invariante I-003 (EmploymentRestaurantAssignment dentro de la misma Company)
invariante I-004 (area_lead con zone coherente y única)
```

### B.3 — Refactor `employmentRepository.ts`

1379 líneas en un solo archivo rompe la regla de mantenibilidad. Separar en:

```
employmentRepository.ts            ← Supabase init + funciones de lectura (300 líneas)
employmentProjectionService.ts     ← temporal rows, role scope magic (400 líneas)
employmentMutationService.ts       ← write operations (300 líneas)
```

### B.4 — Unificar `access_status` + `is_archived`

Eliminar el booleano `is_archived` como campo separado. `access_status = 'archived'` es la única
fuente de verdad (D-027). Requiere migración 025 para consolidar y limpieza en código.

**Done when (Fase B):** todos los tests de F3 en verde. `pnpm build` pasa. `employmentRepository`
tiene menos de 400 líneas por archivo.

---

## FASE C — Completar F5 Schedule (estabilización, no features nuevas)

> Schedule ya funciona. Esta fase cierra los gaps que impiden marcarlo como `done`.

### C.1 — Lock expiry efectivo

`schedule_locks.expires_at` existe en schema pero nunca se evalúa. Implementar en
`scheduleLockService.acquireOrReuseLock()`:

```typescript
if (existing && new Date(existing.expires_at) < new Date()) {
  await forceReleaseLock(scheduleId);
  return acquireLock(scheduleId, actorId);
}
```

Configurar el Vercel Cron Job que limpia locks expirados (ya documentado en canon F5).

### C.2 — Validación de horas semanales máximas (I-013 ampliado)

El canon dice "no solapamiento de turnos" (I-013). Añadir también validación de horas semanales
máximas por empleado según `schedule_config.max_weekly_hours_employee`. Si no está configurado,
no bloquear — solo advertir en el toolbar.

### C.3 — Tests de integración de authz en schedule

```
area_lead no puede editar fuera de su zona
employee no puede ver schedule draft
manager puede forzar unlock sobre area_lead (no sobre otro manager del mismo nivel)
snapshot published no devuelve draft como fallback
```

**Done when (Fase C):** lock expira por tiempo. Tests de authz de schedule en verde.

---

## FASE D — Completar F6 Tasks y F7 Requests + ShiftSwaps

> Los módulos tienen scaffolding. Esta fase los lleva a estado `done` según el test matrix.

### D.1 — Tasks (F6)

- Añadir `confirmTaskAction` como Server Action + botón de confirmación en `TasksPageClient`
  (solo visible si `task_template.requires_confirmation = true`)
- Cron Edge Function: marcar `pending` tasks con `due_at < now` → `overdue`
- Test matrix mínima:
  ```
  createTask (happy path, invariante I-030)
  completeTask (employee puede completar la suya, area_lead la de su zona)
  reassignTask (con las 4 razones válidas)
  confirmTask (solo manager/area_lead con acceso)
  cancelTask (con cancel_reason obligatorio)
  ```

### D.2 — Requests (F7)

- Validar transiciones de estado en `requestService` (no permitir `approved → pending` via API)
- Cron Edge Function: marcar requests con `created_at < now - 30d` sin respuesta → `expired`
- Test matrix mínima:
  ```
  createRequest (empleado para sí mismo)
  approveRequest vacation (solo office, invariante I-020, I-021)
  approveRequest justified_absence (manager puede)
  rejectRequest (con motivo)
  cancelRequest (solo el solicitante o admin)
  expiryLogic (request sin respuesta en 30 días)
  ```

### D.3 — ShiftSwaps (F7)

- Cron Edge Function: marcar swaps sin respuesta del peer en 7 días → `expired`
- Test matrix mínima:
  ```
  proposeShiftSwap (compatibilidad I-011: job_title + responsibility_level)
  respondToShiftSwap peer accept/reject
  approveShiftSwap manager (invariante I-010: no autoaprobación)
  efecto en schedule: swap aprobado actualiza las entries sin republicar
  ```

**Done when (Fase D):** todos los tests en verde. Crons configurados y verificados en Vercel.

---

## FASE E — Completar F8 Incidents

### E.1 — State machine validada en service

```typescript
const VALID_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  reported:    ['in_review'],
  in_review:   ['resolved', 'reported'],
  resolved:    ['closed'],
  closed:      [],
};
```

Validar en `incidentService.updateIncidentStatus()` antes de ejecutar.

### E.2 — Enrutamiento automático por categoría (D-110)

Al crear un incidente, el sistema notifica al responsable correcto según la tabla de D-110.
`stock` notifica a `manager` + `office` simultáneamente (D-111).

### E.3 — Test matrix mínima

```
createIncident (cualquier rol con acceso operativo)
visibilidad restricted (area_lead no ve incidents restricted de otros)
enrutamiento: operational → notifica manager, maintenance → notifica office
enrutamiento: stock → notifica ambos
transiciones válidas (reported → in_review → resolved → closed)
transición inválida rechazada (closed → reported lanza error)
```

**Done when (Fase E):** tests en verde. Enrutamiento verificado manualmente.

---

## FASE F — F9 Delivery Notes + Mindee OCR

> Esta fase tiene el mayor valor de producto. OCR es el diferenciador.

### F.1 — Flujo base sin OCR (ya existe, consolidar)

- Validar state machine: `uploaded → employee_reviewed → office_reviewing → confirmed | rejected`
- Implementar vista detallada del albarán con sus líneas antes de confirmar
- Invariante I-024 en service: `reviewed_by_office ≠ uploaded_by`
- Tests de transiciones y separación de funciones

### F.2 — Integración Mindee

Crear `processOcrDeliveryNote()` en `modules/suppliers/application/`:

```
1. Recibir fileUrl (PDF o imagen ya subida a Supabase Storage)
2. Llamar Mindee API con MINDEE_API_KEY
3. Extraer: document_number, delivery_date, supplier_name, líneas (producto, cantidad, precio)
4. Mapear supplier_name → supplier_id via SupplierProductAlias o crear nuevo proveedor
5. Crear DeliveryNote en estado 'uploaded' con ocr_raw_json poblado
6. Devolver draft review para que el usuario confirme o corrija
```

Nuevo endpoint: `POST /api/suppliers/delivery-notes/ocr`

### F.3 — Test matrix mínima

```
createDeliveryNote (happy path con líneas)
reviewDeliveryNote (empleado o manager)
confirmDeliveryNote (solo office, I-024 separación)
rejectDeliveryNote (con motivo)
rejectDeliveryNote: quien subió no puede validar (I-024)
ocrProcessing: extrae datos básicos de PDF de prueba
```

**Done when (Fase F):** flujo completo funciona. OCR extrae y pre-rellena el formulario.

---

## FASE G — F10 Notifications + Documents

> La infraestructura existe. Esta fase la activa.

### G.1 — Notification Outbox Worker

Crear Supabase Edge Function `process-notification-outbox`:

```typescript
// Se ejecuta via Supabase Cron cada minuto
// Lee notification_outbox donde send_after <= now AND attempts < max_attempts
// Para cada registro:
//   1. Obtener push_devices del recipient
//   2. Llamar Web Push API (VAPID keys de env)
//   3. Si éxito: marcar sent_at en outbox
//   4. Si fallo: incrementar attempts, loguear error
```

### G.2 — Email via Resend

Para notificaciones con `delivery_type = 'email'`:
- Usar `RESEND_API_KEY` + `@react-email/components` (ya en deps)
- Plantillas para: vacation_approved, employment_created, access_status_changed

### G.3 — Documents

- `uploadDocument()`: sube a Supabase Storage + crea registro en `documents`
- `archiveDocument()`: soft delete
- Visibilidad según `document_visibility_enum` (D-047)
- Asociar documentos a: Person, EmploymentRelationship, Request, DeliveryNote

**Done when (Fase G):** push notification llega en dispositivo de prueba.
Email llega cuando vacation aprobada. Documents se pueden adjuntar a requests.

---

## FASE H — Frontend scope-centric completo

> La Fase A inicia esta transición. La Fase H la completa en todos los módulos.

### H.1 — Regla principal (del audit codex)

`activeScope` es el eje de navegación. `effectiveRestaurantId` solo es requerido cuando la acción
es restaurant-bound. `context_required` se reserva para acciones que necesitan restaurante concreto,
no para páginas enteras cuando el scope global es válido.

### H.2 — Módulos a actualizar

Cada módulo de `app/(authenticated)/*/page.tsx` debe pasar de:

```typescript
// ❌ Patrón actual — bloquea roles globales
if (!frontendSession.effectiveRestaurantId) {
  return { mode: 'context_required' };
}
```

A:

```typescript
// ✅ Patrón canónico
switch (frontendSession.activeScope.scopeType) {
  case 'organization':
  case 'chain':
  case 'company':
    return buildGlobalViewModel(frontendSession);
  case 'restaurant':
    return buildRestaurantViewModel(frontendSession, effectiveRestaurantId);
  case 'zone':
    return buildZoneViewModel(frontendSession);
}
```

**Módulos afectados por orden de impacto:**
1. Employees (ya en Fase A)
2. Schedule (vista de supervisión para owner/office)
3. Tasks (vista agregada para manager con múltiples restaurantes)
4. Incidents (vista agregada para office)
5. Requests (aprobación desde office sin seleccionar restaurante)
6. Suppliers (ya implementa `global_overview`)

### H.3 — Navegación del shell

El selector del header debe mostrar el árbol completo de scopes disponibles, no solo restaurantes.
`scope-tree-menu.tsx` ya existe — conectarlo como selector principal.

**Done when (Fase H):** admin puede navegar por Organization → Company → Restaurant sin caer
en `context_required` en ningún módulo. `pnpm test:e2e` cubre los flujos de navegación.

---

## POST-LANZAMIENTO — Fases de segunda generación

> No forman parte del lanzamiento inicial. Se planifican después de tener usuarios reales.

### PL.1 — Vacaciones y entitlements (D-080–D-086)

- Tabla `vacation_entitlements` con `days_available` generado (I-040)
- `approveRequest` verifica saldo antes de aprobar (I-041)
- Ajuste manual con `adjustment_note` obligatorio (I-042)
- Dashboard de saldo por empleado para office

### PL.2 — Fichaje con QR + Geolocalización (D-090–D-093)

- `qr_token` único permanente por restaurante
- App escanea QR → solicita GPS → backend valida distancia (Haversine, D-091)
- `clock_in` / `clock_out` automático por doble escaneo
- Tabla `time_records`

### PL.3 — Platform schema y suscripciones (D-120–D-123)

- Schema `platform` separado del `public`
- `platform.subscriptions` vinculado a `Organization`
- Vista `public.my_subscription` para el tenant (solo lectura)

### PL.4 — OQ pendientes post-lanzamiento

| OQ | Descripción |
|----|-------------|
| OQ-002 | ShiftSwap con aprobación automática por configuración |
| OQ-003 | Preferencias de notificación por usuario |
| OQ-005 | Detección automática de late/no_show |
| OQ-006 | Integración Ágora POS |

---

## Tablero de estado

| Fase | Descripción | Estado | Bloquea |
|------|-------------|--------|---------|
| **B0** | Seguridad + transacciones + RLS gaps | `pending` | Todo lo demás |
| **A** | Employees global scope (trabajo activo) | `in_progress` | H |
| **B** | People + Employment F3 completo | `pending` | C, D, E, F, G |
| **C** | Schedule F5 estabilización | `pending` | — |
| **D** | Tasks F6 + Requests/Swaps F7 | `pending` | E |
| **E** | Incidents F8 | `pending` | F |
| **F** | Delivery Notes + Mindee F9 | `pending` | G |
| **G** | Notifications worker + Documents F10 | `pending` | — |
| **H** | Frontend scope-centric completo | `pending` | — |

---

## Estimación de esfuerzo

| Fase | Esfuerzo estimado |
|------|------------------|
| B0 (seguridad + RLS) | 1–2 días |
| A (employees transition) | 2–3 días |
| B (people + employment F3) | 3–4 días |
| C (schedule F5) | 2 días |
| D (tasks F6 + requests F7) | 4–5 días |
| E (incidents F8) | 2 días |
| F (delivery notes F9 + Mindee) | 4–5 días |
| G (notifications F10 + docs) | 3–4 días |
| H (scope-centric frontend) | 3–4 días |
| **Total** | **~25–32 días de desarrollo** |

---

## Reglas de trabajo

1. **Una fase a la vez.** No abrir una fase si la anterior no tiene todos sus tests en verde
   y `pnpm build` pasando.

2. **El canon manda.** Si algo del código contradice una decisión cerrada del canon, se corrige
   el código, no el canon. Si hay contradicción legítima de dominio, se abre una revisión
   del canon antes de tocar código.

3. **Compat temporal tiene fecha de muerte.** Todo bridge, re-export legacy o alias temporal
   debe tener un comentario `// COMPAT: eliminar en Fase X` con la fase concreta. Si no tiene
   fecha, se elimina en la fase en curso.

4. **Tests antes de merge.** Toda fase tiene su test matrix mínima definida arriba.
   Sin esa cobertura, la fase no pasa a `done`.

5. **DB primero.** Cualquier feature nueva requiere primero la migración SQL correspondiente
   en `supabase/migrations/`, luego el backend, luego el frontend. Nunca al revés.

6. **Commits por alcance.** Usar el prefijo de la fase como scope del commit:
   `B0: fix CSRF en API routes POST`, `A: add org projection in buildEmployeesPageViewModel`.

---

## Criterio de lanzamiento a producción

El sistema puede lanzar a producción cuando:

- [ ] Fases B0, A, B, C, D, E, F, G completas y en verde
- [ ] `pnpm lint` + `pnpm build` + `pnpm test:unit` + `pnpm test:vitest` en verde
- [ ] Al menos 1 test E2E por flujo crítico: login, crear empleado, publicar schedule,
      aprobar request, confirmar albarán
- [ ] Seguridad: CSRF cerrado, cookies con maxAge, RLS verificado con `get_advisors`
- [ ] Push notifications verificadas en dispositivo real
- [ ] Sentry configurado y capturando errores en staging

---

*Este plan reemplaza `implementation_plan.md` y `archive/plans/` como documento de seguimiento activo.*
*Fuentes: canon-v9, implementation_plan.md, audit_codex_v2.md, convergence_plan.md*
