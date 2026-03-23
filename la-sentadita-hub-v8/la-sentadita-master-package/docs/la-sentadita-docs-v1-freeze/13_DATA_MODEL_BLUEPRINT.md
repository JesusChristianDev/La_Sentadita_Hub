# 13 — Data Model Blueprint v5

## Decisiones de diseño integradas en v5
- `persons.person_id` = `auth.users.id` (mismo UUID, sin join adicional)
- `area_leads` eliminada: `area_lead` es `system_role` con scope de zona en `role_scope_assignments`
- `shift_templates`, `schedule_config`, `restaurant_hours` incorporadas del sistema operativo anterior
- `schedule_publish_events`: historial real de publicaciones de horario
- `schedule_entry_adjustments` + `schedule_entry_logs`: historial detallado de cambios
- `notification_outbox`: patrón outbox con reintentos para push resiliente
- `incident.severity`: tipado con enum (low, medium, high, critical)
- Departamentos de oficina: OPEN QUESTION, no implementado en v5

---

## Jerarquía organizativa

### chains
- chain_id (PK)
- name
- created_at, updated_at

### companies
- company_id (PK)
- chain_id (FK chains)
- name, legal_identifier
- created_at, updated_at

### restaurants
- restaurant_id (PK)
- chain_id (FK chains)
- company_id (FK companies)
- name, timezone, is_active
- created_at, updated_at

### zones
- zone_id (PK)
- restaurant_id (FK restaurants)
- name, operational_area, is_active
- created_at, updated_at

---

## Configuración operativa

### restaurant_hours
- restaurant_hours_id (PK)
- restaurant_id (FK restaurants)
- day_of_week (0–6), is_open
- open_time, close_time, crosses_midnight
- UNIQUE (restaurant_id, day_of_week)

### schedule_config
- schedule_config_id (PK)
- restaurant_id (FK restaurants, UNIQUE)
- min_shift_duration, min_split_break, timezone
- updated_by (FK persons), updated_at

---

## Personas y empleo

### persons
- person_id (PK = auth.users.id)
- chain_id (FK chains)
- first_name, last_name, phone, email
- birth_date, identity_document, avatar_url
- system_role (fuente única de verdad del rol)
- is_archived
- created_at, updated_at

### role_scope_assignments
- assignment_id (PK)
- person_id (FK persons)
- scope_type, scope_id, active
- created_at, updated_at
- NOTA: area_lead usa scope_type = zone

### employment_relationships
- employment_id (PK)
- person_id (FK persons)
- company_id (FK companies)
- restaurant_id (FK restaurants)
- job_title, contract_type
- agreed_monthly_hours, max_daily_hours
- requires_schedule, availability_json, planning_notes
- start_date, end_date, active_principal
- created_at, updated_at

---

## Scheduling

### shift_templates
- shift_template_id (PK)
- restaurant_id (FK restaurants)
- name, type (continuous | split)
- start_time, end_time
- split_start_time, split_end_time (nullable)
- is_active
- created_at, updated_at

### schedules
- schedule_id (PK)
- restaurant_id (FK restaurants)
- week_start (lunes obligatorio)
- status (draft | published)
- created_by (FK persons), published_by (FK persons)
- published_at
- created_at, updated_at
- UNIQUE (restaurant_id, week_start)

### schedule_publish_events
- publish_event_id (PK)
- schedule_id (FK schedules)
- published_by (FK persons)
- published_at, prev_published_at

### schedule_entries
- schedule_entry_id (PK)
- schedule_id (FK schedules)
- employment_id (FK employment_relationships)
- entry_date, day_type
- shift_template_id (FK shift_templates, nullable)
- start_time, end_time, split_start_time, split_end_time
- zone_id (FK zones, nullable)
- source (manual | auto)
- created_at, updated_at

### schedule_entry_adjustments
- adjustment_id (PK)
- schedule_entry_id (FK schedule_entries)
- adjusted_by (FK persons)
- adjusted_at
- reason (obligatorio, no vacío)
- previous_*/new_* para day_type, times, zone_id, shift_template_id

### schedule_entry_logs
- log_id (PK)
- schedule_entry_id (FK schedule_entries)
- changed_at, changed_by (FK persons, nullable)
- change_source (manual | auto)
- previous_*/new_* para day_type, times, zone_id, shift_template_id

### schedule_locks
- schedule_lock_id (PK)
- schedule_id (FK schedules, UNIQUE)
- lock_type (restaurant_total | zone_only)
- zone_id (FK zones, nullable)
- holder_person_id (FK persons), holder_role
- acquired_at, expires_at, released_at, release_reason

### schedule_lock_logs
- lock_log_id (PK)
- schedule_id (FK schedules)
- locked_by (FK persons), locked_at
- released_by (FK persons, nullable)
- release_type (natural | timeout | forced)
- released_at

---

## Tasks

### task_templates
- task_template_id (PK)
- restaurant_id (FK restaurants)
- title, description
- recurrence_type, due_rule
- requires_confirmation, confirmation_mode
- confirmation_role, confirmation_employee_id
- plannable_in_schedule, active
- created_at, updated_at

### task_instances
- task_instance_id (PK)
- task_template_id (FK task_templates, nullable)
- restaurant_id (FK restaurants)
- task_date, shift_context
- assigned_role, assigned_zone_id, assigned_employee_id
- task_status, cancel_reason, reassignment_reason
- due_at, completed_by, completed_at
- requires_confirmation, confirmed_by, confirmed_at
- confirmation_note, confirmation_photo_url
- created_at, updated_at

---

## Procedures y Shift Swap

### procedures
- procedure_id (PK)
- employment_id (FK employment_relationships)
- procedure_type, status
- requested_by (FK persons), reviewed_by (FK persons)
- effective_start_date, effective_end_date
- resolution_note
- created_at, updated_at

### shift_swap_requests
- shift_swap_request_id (PK)
- requester_employee_id (FK persons)
- target_employee_id (FK persons)
- requester_schedule_entry_id (FK schedule_entries)
- target_schedule_entry_id (FK schedule_entries)
- status, requested_at, peer_responded_at
- reviewed_by (FK persons), reviewed_at
- reason

---

## Incidents

### incidents
- incident_id (PK)
- restaurant_id (FK restaurants)
- zone_id (FK zones, nullable)
- category, sensitivity
- title, description
- severity (low | medium | high | critical)
- reported_by (FK persons), primary_owner (FK persons)
- status
- created_at, updated_at

---

## Documents

### documents
- document_id (PK)
- document_type, owner_type, owner_id
- visibility, document_status
- file_url, version, requires_reauth
- created_by (FK persons)
- created_at, updated_at

---

## Notifications

### notifications
- notification_id (PK)
- recipient_user_id (FK persons)
- notification_type, entity_type, entity_id
- delivery_type
- created_at, read_at

### notification_outbox
- outbox_id (PK)
- recipient_person_id (FK persons)
- notification_type, entity_type, entity_id
- title, body
- send_after, processing_since
- processed_at, failed_at
- attempts, last_error
- created_at

### push_devices
- push_device_id (PK)
- person_id (FK persons)
- endpoint (UNIQUE), p256dh, auth_key
- platform, last_seen_at
- created_at

---

## Audit

### audit_logs
- audit_id (PK)
- entity_type, entity_id
- action
- actor_user_id (FK persons), actor_role
- scope_type, scope_id
- previous_value_json, new_value_json
- reason, trace_id
- created_at
