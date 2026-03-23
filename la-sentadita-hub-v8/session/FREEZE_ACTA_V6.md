# La Sentadita Hub — Acta de Freeze Oficial v6
# Fecha: 18 marzo 2026

---

## Estado oficial

**Core Architecture Freeze v6 — CONGELADO**

El v6 es la base arquitectónica oficial del proyecto.
No se reabre arquitectura salvo contradicción grave nueva.
El siguiente trabajo es implementación, no más diseño.

---

## Qué queda CERRADO — no se reabre

### Modelo de dominio
- Jerarquía `Chain → Company → Restaurant → Zone` congelada
- `person.system_role` como única fuente de verdad del rol
- `persons.person_id` = `auth.users.id` (Supabase Auth nativo)
- `employment_relationship` = contexto laboral, sin permisos
- `role_scope_assignment` = scopes del rol, sin roles alternativos
- `area_lead` es `system_role`, no tabla separada
- `responsibility_level` derivado de `system_role` via función pura

### Schema SQL
- Schema v6 en `01_schema.sql` es el único schema oficial
- Hardening B-01 a B-10 integrado completamente
- Soft delete en todas las entidades principales (`is_archived` + `deleted_at`)
- Trigger `validate_company_chain_id_change()` bloqueo amplio
- Trigger `validate_restaurant_chain_coherence()` en insert/update
- Trigger `validate_role_scope_assignment_scope_id()` integridad polimórfica
- Trigger `validate_document_owner_id()` integridad polimórfica
- `UNIQUE (employment_id, entry_date)` en `schedule_entries`
- `audit_logs.actor_user_id ON DELETE SET NULL`
- `notification_outbox` con `max_attempts` y dead letter

### Enums y tipos
- `schedule_entry_source_enum`: 10 valores. `auto` eliminado para siempre
- `publish_type_enum`: `manual` vs `auto` en `schedule_publish_events`
- `incident_severity_enum`: `low`, `medium`, `high`, `critical`
- `notification_type_enum`: 29 tipos definidos
- `audit_action_enum`: incluye `procedure_dates_updated`, `move_restaurant`, `move_company`

### Invariantes
- I1 a I20 formalizados, incluyendo **I3** (nuevo en v6)
- I3: no solapamiento + un restaurante por día, respaldado por UNIQUE en DB

### ACL
- Descarga de documentos: tabla completa por rol sin "según política"
- Cancelación de procedures por empleado: tipos y estados definidos
- Cierre de procedures: por tipo, quién y cuándo
- Edición de procedures aprobados: campos, roles y estados permitidos
- `area_lead` en Procedures: igual que `employee`
- Soft delete ACL: quién archiva qué entidad
- `MoveRestaurant`: admin + chain_owner
- `MoveCompany`: solo admin

### Notificaciones
- 29 eventos con destinatario y canal definidos
- Regla general: push cuando el usuario necesita actuar, in-app cuando es informativo
- `task_confirmed`: solo audit, sin notificación
- `incident_restricted_marked`: solo al manager del restaurante

### Locks de horario
- Cron Job cada 5 minutos (mecanismo principal)
- On-read como segunda capa de seguridad

### Reautenticación en documentos
- Flujo B (15 min) para `employee_visible` y `management_visible`
- Flujo A (contraseña explícita) para `restricted_management` y `administrative_only`

### Operaciones de reasignación
- `MoveRestaurant`: datos operativos automáticos, datos jurídicos con confirmación explícita
- `MoveCompany`: admin only, restaurantes automáticos, documentos legales quedan con empresa original

### Company Chain Reassignment Rule v1 (congelada)
Una `company` solo puede cambiar de `chain_id` si no tiene ninguna de las siguientes dependencias activas:
1. Restaurantes asociados (`is_archived = false`)
2. Relaciones laborales activas (`end_date is null AND is_archived = false`)
3. Documentos activos vinculados a esas relaciones laborales (`document_status = active`)
4. Procedimientos activos vinculados a esas relaciones laborales (`status NOT IN (closed, cancelled, rejected)`)

Schedules, incidencias y task_instances quedan cubiertas implícitamente por el bloqueo
de restaurantes — no pueden existir sin un restaurante activo asociado.

Una empresa sin ninguna de estas dependencias puede considerarse sin vida operativa real
y su `chain_id` puede modificarse.

Esta regla está implementada en el trigger `validate_company_chain_id_change()` del schema v6.

### Stack tecnológico
- 26 herramientas definidas con versiones verificadas (ver `la-sentadita-stack-definitivo-v1.docx`)
- Migraciones: schema limpio ahora, migraciones numeradas en producción

### Regla operativa obligatoria (soft delete)
Toda query del sistema que consuma entidades con soft delete debe filtrar:
```sql
WHERE is_archived = false
-- y/o
WHERE deleted_at IS NULL
```
Sin esta disciplina de lectura, el soft delete no garantiza consistencia en la UI.

---

## Qué queda DIFERIDO — documentado pero no implementado en v1

- Departamentos dentro de oficina: OPEN QUESTION. Pendiente de definir el papel exacto de cada persona de oficina.
- RLS completo por scope/restaurante/zona: intencional, backend centraliza la lógica
- Prevención dura de solapamientos de horario en DB: cubierto por UNIQUE entry/día, el overlap de horas es responsabilidad del backend
- Triggers automáticos de auditoría por tabla: la auditoría es responsabilidad del backend
- Integración con Ágora POS: `import` en el enum reservado, implementación futura
- Marketplace de coberturas de turno: fuera de v1
- Manager multi-scope como comportamiento estándar: reservado para versión futura

---

## Qué se puede implementar SIN reabrir arquitectura

### Fase 0 — Fundación (siguiente paso)
- Instalar dependencias del stack verificado
- Aplicar `01_schema.sql` en Supabase (reset + apply)
- Configurar variables de entorno con `@t3-oss/env-nextjs`
- Configurar Sentry
- Configurar Vitest
- Estructura de carpetas del backend

### Fase 1 — AuthZ + Audit
- `deriveResponsibilityLevel()` en `src/modules/authz/domain/`
- Módulo `authz` con `can()` y `assertCan()`
- Helper `insert_audit_log()` ya existe en el schema
- `RequestContext` con `activeScopes` como array

### Fase 2 — People + Employment
### Fase 3 — Scheduling
### Fase 4 — Tasks
### Fase 5 — Procedures
### Fase 6 — Shift Swap
### Fase 7 — Incidents
### Fase 8 — Documents
### Fase 9 — Notifications + Push
### Fase 10 — Albaranes
- Mindee OCR integration
- `suppliers`, `products`, `supplier_product_aliases`
- `delivery_notes`, `delivery_note_lines`
- Workflow: uploaded → employee_reviewed → office_reviewing → confirmed | rejected

---

## Firmas de acuerdo

Revisado y validado por:
- Claude (Anthropic) — análisis arquitectónico
- ChatGPT (OpenAI) — revisión técnica independiente
- JesusChristianDev — decisor del producto

**Conclusión conjunta:** el proyecto ya no está discutiendo problemas básicos de modelo.
Está entrando en fase de hardening + implementación.

---

*Acta generada el 18 de marzo de 2026*
