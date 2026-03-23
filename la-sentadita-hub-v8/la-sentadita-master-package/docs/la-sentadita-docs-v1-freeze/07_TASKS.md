# 07 — Tasks

## Estados oficiales
- `pending`
- `needs_reassignment`
- `completed`
- `overdue`
- `cancelled`

## Confirmación
No es estado.

Campos:
- `requires_confirmation`
- `confirmed_by`
- `confirmed_at`
- `confirmation_note`
- `confirmation_photo`

## Invariante
### I6
Toda tarea debe nacer con al menos un responsable válido.

## Razones de cancelación
- `schedule_change`
- `employment_change`
- `template_deactivated`
- `manual_cancel`

## Razones de reasignación
- `employment_change`
- `procedure_conflict`
- `shift_swap`
- `manual_reassignment_required`

## Reglas de integridad
### Si `cancelled`
- `cancel_reason` obligatorio
- `reassignment_reason` vacío

### Si `needs_reassignment`
- `reassignment_reason` obligatorio
- `cancel_reason` vacío
