# 05 — People & Employment

## Person
Una persona es la identidad única dentro de la cadena.
El `system_role` vive en `person` y es la única fuente de verdad del rol del sistema.

Campos clave:
- `person_id`
- `chain_id`
- `first_name`
- `last_name`
- `phone`
- `email`
- `birth_date`
- `identity_document`
- `avatar_url`
- `system_role`

## Invariantes
### I1 — Persona única en la cadena
No debe existir duplicada.

### I2 — Una sola relación laboral activa principal
Una persona no puede tener más de una `employment_relationship` activa principal.

## Employment Relationship
Conecta persona con su contexto laboral operativo.
No define permisos del sistema. El rol se lee desde `person.system_role`.

Conecta persona con:
- `company_id` (legal)
- `restaurant_id` (operativo)

Campos clave:
- `employment_id`
- `person_id`
- `company_id`
- `restaurant_id`
- `job_title`
- `contract_type`
- `agreed_monthly_hours`
- `max_daily_hours`
- `requires_schedule`
- `availability_json`
- `planning_notes`
- `start_date`
- `end_date`
- `active_principal`

## Role Scope Assignment
Materializa los scopes del rol activo de la persona.
No introduce un rol alternativo. El rol sigue siendo `person.system_role`.

Campos clave:
- `assignment_id`
- `person_id`
- `scope_type`
- `scope_id`
- `active`
