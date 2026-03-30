# Datos mínimos v0

## Entidades mínimas (MVP)
- Restaurant
  - id (uuid)
  - name
  - logo?
  - address?
  - shift_cutoff_time

- User/Profile (empleado)
  - id (uuid) = auth.users.id
  - employee_code (int, GENERATED ALWAYS AS IDENTITY, UNIQUE global, inmutable)
  - full_name
  - email
  - phone
  - address_home
  - emergency_phone
  - role (employee|manager|office|admin)
  - position_id
  - area (sincronizada con el puesto; barra|sala|cocina)
  - restaurant_id (para employee/manager)
  - is_area_lead (bool)
  - hire_date
  - vacation_initial_balance
  - must_change_password (bool)
  - end_date?

- Position (catálogo)
  - id
  - name
  - area (barra|sala|cocina)
  - special: gerente/subgerente (solo si role=manager y asignable por office/admin)

- ScheduleWeek
  - restaurant_id
  - week_start_date (lunes)
  - status: DRAFT/PUBLISHED (modelo “draft compartido + published snapshot”)

- ScheduleCell/Shift (por empleado y día)
  - key lógica: {restaurant_id, week_start_date, employee_id, date}
  - type: continuous_shift | split_shift | day_off | vacation | sick_leave | absence | not_applicable
  - start/end (si aplica)
  - tags? (si aplica)

- TaskTemplate
  - id
  - area (barra|sala|cocina|general)
  - preferred_positions?

- TaskAssignment
  - key lógica: {restaurant_id, date, slot, area, template_id, assigned_user_id}
  - status: todo/done (+ timestamp + actor al done)

- Request
  - type: vacation | sick_leave
  - status: PENDING_MANAGER | PENDING_OFFICE | APPROVED | REJECTED | CANCELLED
  - dates + fields (PDF obligatorio en sick_leave)

- Document
  - type: payroll(month-year) | contract
  - storage_path
  - owner_user_id
  - audit opened/downloaded
  - reconfirmation session TTL=10min (a nivel de sesión/dispositivo)

- Incident
  - type (editable)
  - severity: baja|media|alta
  - area: barra|sala|cocina|general
  - created_by
  - assigned_to (office/manager/area_lead)
  - SLA reminders

- WorkedHours
  - planned_hours (desde horario publicado)
  - adjustment_hours
  - actual_hours = planned + adjustment
  - office/manager edit adjustment

- AuditLog (retención 1 año) + ScheduleDraftChange (retención 90 días, batching)
- OutboxMessage (email/push): pending/sending/sent/failed/dead + retries + alerta al dead

## Identificadores que NO cambian
- Profile.id = uuid (auth.users.id)
- employee_code = int identity, UNIQUE global, inmutable
- Semana = (restaurant_id, week_start_date=lunes)
