# 06 — Scheduling

## Estados de una semana
- `draft`
- `published`

## Regla de visibilidad
### I16
Para el empleado, la única verdad oficial es la **última versión publicada**.

## Day Types
- `work`
- `rest`
- `unscheduled`
- `vacation`
- `sick_leave`
- `justified_absence`
- `absent`
- `not_applicable`
- `end_of_contract`

## Invariantes
### I5
Los `day_type` derivados no se editan manualmente.

### I5b
- antes de `start_date` → `not_applicable`
- después de `end_date` → `end_of_contract`

### No solapamiento
Un empleado no puede tener dos turnos solapados el mismo día.

### Un restaurante por día
Una persona no puede estar en dos restaurantes distintos el mismo día.

## Locks
Tipos:
- `restaurant_total`
- `zone_only`

Prioridad:
- manager
- sub_manager
- area_lead

TTL:
- 10 minutos
