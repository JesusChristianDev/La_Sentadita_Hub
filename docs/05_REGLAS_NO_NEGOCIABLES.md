# Reglas no negociables v0.1

## Seguridad / permisos
- Precedencia de roles: admin > office > manager > area_lead > employee.

- Alcance por restaurante (server-side, obligatorio):
  - Si role in (employee, manager, area_lead):
    - restaurant_scope = profile.restaurant_id
    - cualquier intento de leer/escribir recursos de otro restaurante => 403/404 (según política) y sin filtrar existencia.
  - Si role in (office, admin):
    - restaurant_scope = ANY (con selector/parámetro), excepto la restricción de office sobre horarios.

- Office NO ve ni gestiona horarios (ni editor, ni PDF, ni rangos). Solo totales numéricos de horas.
- Solo office/admin pueden asignar role=manager y positions especiales (gerente/subgerente).
- Manager es el único que puede publicar horarios.

## Consistencia horarios/tareas
- Draft es único y compartido (no hay draft por usuario).
- El servidor rechaza escrituras en draft si no hay lock válido (TOTAL o ZONE).
- “Last write wins” solo aplica entre escrituras válidas y dentro de la misma unidad de conflicto (celda/assignment).
- No se puede asignar una tarea si el empleado no tiene turno compatible en {date, slot}.
- Si un día pasa a vacation/sick_leave/day_off/absence/not_applicable -> se eliminan automáticamente tareas asignadas de ese día a ese usuario y se audita.

## Trámites
- Workflow 2 pasos (manager luego office) con estados cerrados.
- Cancelación es compare-and-swap: si ya cambió de estado -> 409 y devolver estado actual.
- Baja/enfermedad requiere PDF obligatorio; cierre de baja abierta solo office.

## Outbox (emails/push)
- Ninguna operación crítica envía emails/push dentro de una transacción de DB.
- Outbox tiene retry + dead-letter; al pasar a dead -> audit + alerta interna + acción manual (reintentar/ignorar).

## Horas y republicación
- planned_hours salen del horario publicado.
- actual_hours = planned_hours + adjustment_hours.
- Si se republica y hay adjustment_hours != 0 -> warning obligatorio y reset de ajustes (con auditoría).
