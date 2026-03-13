begin;

-- ============================================================
-- 005_schedules_function_search_path_cleanup
-- Clears remaining schedule-related mutable search_path warnings.
-- ============================================================

alter function public.apply_schedule_entry_adjustment(
  uuid,
  text,
  text,
  time,
  time,
  time,
  time,
  uuid,
  uuid
) set search_path = '';

alter function public.proc_protect_historic_schedule() set search_path = '';

commit;
