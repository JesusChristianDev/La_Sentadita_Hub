-- C.2: max_weekly_hours_employee en schedule_config
-- Permite configurar un límite de horas semanales por empleado (advertencia, no bloqueo).
ALTER TABLE public.schedule_config
  ADD COLUMN IF NOT EXISTS max_weekly_hours_employee integer;
