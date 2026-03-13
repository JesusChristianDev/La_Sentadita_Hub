alter table public.schedule_entries
  drop constraint if exists schedule_entries_day_type_check;

alter table public.schedule_entries
  add constraint schedule_entries_day_type_check
  check (
    day_type in (
      'work',
      'rest',
      'unscheduled',
      'vacation',
      'sick_leave',
      'absent',
      'not_applicable',
      'end_of_contract'
    )
  );
