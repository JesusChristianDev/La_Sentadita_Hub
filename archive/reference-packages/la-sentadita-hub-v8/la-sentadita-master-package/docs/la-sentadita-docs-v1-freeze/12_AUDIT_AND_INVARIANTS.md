# 12 — Audit and Invariants

## Audit Log
Append-only, inmutable.

Campos:
- `audit_id`
- `entity_type`
- `entity_id`
- `action`
- `actor_user_id` (ON DELETE SET NULL — el log sobrevive a la eliminación del actor)
- `actor_role`
- `scope_type`
- `scope_id`
- `previous_value_json`
- `new_value_json`
- `reason`
- `trace_id`
- `created_at`

## Eventos auditables v6

### People / Employment
- `person_created`
- `person_identity_updated`
- `person_archived`
- `system_role_changed`
- `employment_relationship_created`
- `employment_relationship_updated`
- `employment_relationship_terminated`
- `role_scope_assignment_created`
- `role_scope_assignment_updated`
- `role_scope_assignment_deactivated`

### Org Operations
- `move_restaurant`
- `move_company`

### Scheduling
- `schedule_created`
- `schedule_entry_updated`
- `schedule_published`
- `schedule_republished`
- `schedule_lock_acquired`
- `schedule_lock_denied`
- `schedule_lock_expired`
- `schedule_lock_force_released`

### Tasks
- `task_created`
- `task_status_changed`
- `task_confirmed`
- `task_reassigned`
- `task_cancelled`
- `task_generated_from_schedule`

### Procedures
- `procedure_created`
- `procedure_status_changed`
- `procedure_derived`
- `procedure_applied_to_schedule`
- `procedure_dates_updated`

### Shift Swap
- `shift_swap_requested`
- `shift_swap_peer_accepted`
- `shift_swap_peer_rejected`
- `shift_swap_manager_approved`
- `shift_swap_manager_rejected`
- `shift_swap_expired`
- `shift_swap_applied`

### Incidents
- `incident_created`
- `incident_status_changed`
- `incident_restricted_marked`
- `incident_assigned`

### Documents
- `document_uploaded`
- `document_viewed`
- `document_downloaded`
- `document_archived`
- `document_superseded`

### Notifications
- `notification_created`
- `notification_sent_push`
- `notification_read`

### Delivery Notes
- `delivery_note_uploaded`
- `delivery_note_employee_reviewed`
- `delivery_note_office_confirmed`
- `delivery_note_office_rejected`
- `supplier_created`
- `product_created`

## Invariantes

- **I1** Persona única en la cadena
- **I2** Una sola relación laboral activa principal por persona
- **I3** No solapamiento de turnos + un restaurante por día por empleado
- **I4** Nadie autoaprueba su propio trámite
- **I5** Day types derivados no se editan manualmente
- **I5b** La vigencia laboral limita Scheduling
- **I6** Una tarea no puede existir sin responsable
- **I8** Restricted no visible para area_lead
- **I9** El creador ve su incidencia con límites si es restricted
- **I10** Admin es global de plataforma
- **I11** Chain owner no implica acceso total por defecto
- **I12** Acceso = rol + scope + acción
- **I13** Vacaciones solo bloquean Scheduling cuando están aprobadas
- **I14** Ausencia inicial no automática
- **I15** Solo algunas tareas pueden planificarse desde Scheduling
- **I16** Lo publicado es la verdad visible para empleados
- **I17** El usuario ve sus propios documentos, salvo internos no destinados a él
- **I18** Audit log append-only
- **I19** Notificación no equivale a auditoría
- **I20** Eventos agrupables por trace_id
