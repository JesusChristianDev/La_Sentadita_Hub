# La Sentadita Hub — SPEC MAESTRO v0.1

## 0) Documentos fuente (source of truth)
- 00_INTENCION.md
- 01_MODULOS.md
- 02_ROLES_Y_ALCANCE.md
- 03_DATOS_MINIMOS.md
- 04_FLUJOS_CRITICOS.md
- 05_REGLAS_NO_NEGOCIABLES.md
- 07_NFRs.md
- 08_PERMISOS_MATRIZ.md
- 09_CSV_IMPORT_SPEC.md
- 10_STATE_MACHINES.md
- 11_UI_MVP_PANTALLAS.md
- 13_HEADER_MVP_MATRIZ.md

---

## 1) Objetivo del MVP (2–3 líneas)
PWA interna para una cadena de restaurantes para operar el día a día:
horarios (draft/publicado), tareas, trámites, documentos, incidencias y horas/reportes,
con permisos por rol y auditoría.

Usuario principal del MVP: Manager de restaurante.

---

## 2) Alcance del MVP (prioridades)
### MUST
- Auth: verificación email + reset + must_change_password
- Gestión de usuarios/perfiles + roles + puestos + áreas + employee_code
- Importación CSV atómica
- Multi-restaurante desde día 1
- Horarios: draft compartido + publicado (snapshot)
- Tareas integradas
- Horas: planned + ajuste + actual + reportes + export
- Auditoría general + auditoría granular draft schedule
- Reglas server-side: locks, permisos, consistencia turno↔tarea, outbox

### SHOULD (pos-MVP inmediato)
- Editor horario escritorio tipo Excel (locks TOTAL/ZONE)
- Edición móvil por día
- Trámites (vacaciones + baja/enfermedad, workflow 2 pasos)
- Documentos (nóminas + contrato PDF, reconfirmación 10 min)
- Anuncios + normas
- Incidencias (tipos editables + severidad + SLA recordatorios)
- Push notifications (opt-in + overrides urgentes/alta)

### NO (MVP)
- Integración AGORA POS
- 2FA
- Gestión de festivos
- UI de auditoría
- Ack obligatorio de lectura en anuncios
- Backup/export completo desde UI

---

## 3) Roles, precedencia y alcance (resumen operativo)
### Roles
- employee
- manager
- office
- admin

### Capability (NO es rol)
- area_lead = employee con is_area_lead=true y area=(barra|sala|cocina)

### Precedencia (obligatoria)
admin > office > manager > area_lead > employee

### Restricciones clave (alcance por restaurante)
- Manager NO es global de la cadena: es manager SOLO de su restaurante.
- employee también está ligado a 1 restaurante.
- office/admin son globales (con selector de restaurante).
- No existe "manager global".

Regla de autorización obligatoria:
- Cualquier request del manager debe quedar limitado a restaurant_id = profile.restaurant_id.
- Intentos de acceder a otros restaurantes => 403/404 (según política).

### Restricción clave adicional
- office NO ve ni gestiona horarios (ni editor, ni PDF, ni rangos). Solo totales numéricos de horas.

---

## 4) Datos mínimos (resumen + contratos)
Entidades y claves: ver 03_DATOS_MINIMOS.md.

Contratos críticos:
- ScheduleWeek:
  - clave lógica: (restaurant_id, week_start_date)
  - estado: DRAFT / PUBLISHED (snapshot publicado)
- ScheduleCell/Shift:
  - clave lógica: {restaurant_id, week_start_date, employee_id, date}
- TaskAssignment:
  - clave lógica: {restaurant_id, date, slot, area, template_id, assigned_user_id}
- Request:
  - workflow 2 pasos con estados cerrados
- Outbox:
  - fuera de transacción (ver reglas)

---

## 5) Flujos críticos del MVP
Ver 04_FLUJOS_CRITICOS.md. Se implementan como vertical slices con tests.

- Flujo 1: Import CSV (atómico)
- Flujo 2: Horarios draft compartido + publicar (locks, validaciones, snapshot)
- Flujo 3: Vacaciones (2 pasos, CAS/409)

---

## 6) Reglas no negociables convertidas a CHECKS verificables (server-side)
### Seguridad / permisos
- CHECK-PERM-1: Precedencia de roles aplicada en server (admin > office > manager > area_lead > employee).
- CHECK-PERM-2: manager y employee SOLO pueden operar sobre su restaurant_id (profile.restaurant_id). Cualquier cross-restaurant => 403/404.
- CHECK-PERM-3: office recibe 403/404 en CUALQUIER lectura/escritura de schedule (draft/published/pdf/ranges/cells).
- CHECK-PERM-4: solo office/admin pueden asignar role=manager y positions especiales (gerente/subgerente).
- CHECK-PERM-5: solo manager/admin pueden publicar horarios.

### Locks de horarios
- CHECK-LOCK-1: servidor rechaza escrituras de draft sin lock válido (TOTAL o ZONE).
- CHECK-LOCK-2: “last write wins” solo entre escrituras válidas y dentro de la misma unidad de conflicto.
- CHECK-LOCK-3: TTL=60s + heartbeat=15s; lock expira si el cliente cae.
- CHECK-LOCK-4: conflictos de lock usan HTTP 423 Locked.

### Consistencia horarios/tareas
- CHECK-TASK-1: servidor rechaza asignar tarea si el empleado no tiene turno compatible en {date, slot}.
- CHECK-TASK-2: si un día pasa a vacation/sick_leave/day_off/absence/not_applicable:
  - se eliminan automáticamente tareas del día para ese usuario
  - se registra auditoría

### Trámites
- CHECK-REQ-1: workflow 2 pasos (manager luego office) con estados cerrados.
- CHECK-REQ-2: cancelación CAS: si cambió el estado -> 409 + estado actual.
- CHECK-REQ-3: sick_leave requiere PDF obligatorio; cierre de baja abierta solo office.

### Outbox
- CHECK-OUT-1: NO se envía email/push dentro de transacción crítica.
- CHECK-OUT-2: retry + dead-letter; al pasar a dead -> audit + alerta interna + acción manual.
- CHECK-OUT-3: max_retries=10 antes de DEAD.

### Horas y republicación
- CHECK-HOURS-1: planned_hours salen del horario publicado.
- CHECK-HOURS-2: actual_hours = planned_hours + adjustment_hours.
- CHECK-HOURS-3: si republica y adjustment_hours != 0:
  - warning obligatorio
  - reset de ajustes
  - auditoría

---

## 7) Criterios de aceptación (Given/When/Then)
### CA-AUTHZ-1 (scope manager)
Dado un manager del restaurante A,
cuando intenta leer/escribir recursos del restaurante B,
entonces el servidor responde 403/404 y no revela datos.

### CA-CSV-1 (atómico)
Dado un CSV con 1 error de validación,
cuando office intenta importar,
entonces NO se crea ningún usuario/perfil/outbox y se devuelve reporte de errores.

### CA-CSV-2 (éxito)
Dado un CSV válido,
cuando office confirma importación,
entonces se crean auth.users + profiles + passwords temporales en una transacción,
y se crean outbox_messages para emails (sin enviar dentro de la transacción).

### CA-SCH-1 (locks)
Dado un schedule en draft,
cuando alguien escribe sin lock válido,
entonces el servidor responde 423 y NO guarda cambios.

### CA-SCH-2 (publicar)
Dado un manager,
cuando publica un schedule semanal,
entonces:
- valida “semana completa”
- requiere diff obligatorio + confirmación
- genera snapshot PUBLISHED y notifica cambios relevantes.

### CA-TASK-1 (compatibilidad)
Dado un employee sin turno compatible en date+slot,
cuando se intenta asignar una tarea a ese slot,
entonces el servidor lo rechaza (422) y registra evento de validación.

### CA-REQ-1 (2 pasos)
Dado un employee,
cuando crea solicitud de vacaciones,
entonces queda PENDING_MANAGER y se notifica manager.

### CA-REQ-2 (CAS cancel)
Dado un request en PENDING_MANAGER,
cuando employee cancela con expected_status=PENDING_MANAGER,
entonces se cancela.
Si el estado real ya no coincide, 409 + estado actual.

### CA-OUT-1 (dead-letter)
Dado un outbox message que falla repetidamente,
cuando supera max_retries,
entonces pasa a DEAD, se audita y se crea alerta interna.

### CA-HOURS-1 (republicar)
Dado adjustment_hours != 0,
cuando se republica el horario,
entonces se muestra warning y se resetean ajustes con auditoría.

---

## 8) Métricas del MVP (cerradas)
- p95 “click publicar → snapshot disponible”: < 2s (server-side)
- p95 “pending → sent” en outbox: < 15 min
- Locks: TTL 60s, heartbeat 15s

---

## 9) Decisiones cerradas / abiertas
### Cerradas
- Roles + precedencia
- manager NO es global: scope = 1 restaurante (profile.restaurant_id)
- office/admin globales con selector de restaurante
- office no ve horarios
- locks server-side + HTTP 423
- outbox fuera de transacción + max_retries=10
- draft compartido + snapshot publicado
- CSV:
  - UTF-8, coma
  - restaurant_ref = restaurant_code
  - position_ref = position_name (case-insensitive)
  - create-only (si email existe => error y 0 import)
  - límites 5MB / 2000 filas
  - reporte de errores descargable en CSV
- PWA offline: no offline real (solo caché de assets)
- PDFs: 10MB máx
- Semana inicia en lunes

### Abiertas (mínimas)
- Umbrales finos de alertas por entorno (si se necesita)
