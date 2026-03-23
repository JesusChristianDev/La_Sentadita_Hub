# 08 — Procedures and Shift Swap

## Procedure Types
- `vacation`
- `sick_leave`
- `justified_absence`
- `absence`

## Regla global
Nadie puede autoaprobar su propio trámite.

## Vacations
Se solicitan por rango:
- permitido un solo día
- permitido varios días

Solo bloquean Scheduling cuando están `approved`.

## Absence
No se crea automáticamente en v1.

## Procedure override rule v1
Cuando un procedimiento aprobado bloquea fechas:
- sobrescribe automáticamente el horario
- elimina turnos incompatibles
- tareas afectadas pasan a `needs_reassignment`
- no hace falta republicación manual

## Shift Swap — definición v1
Intercambio de turnos entre dos empleados **en la misma fecha**, donde cada uno toma el turno completo del otro.

### Compatibilidad
- mismo restaurante
- activos en esa fecha
- mismo `job_title`
- mismo `responsibility_level`
