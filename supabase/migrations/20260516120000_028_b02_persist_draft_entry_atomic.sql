-- B0.2: persist_draft_entry_atomic
-- UPDATE (or INSERT) a schedule entry and its audit log in a single transaction.
-- This prevents audit trail corruption if the log INSERT fails after the entry is mutated.
--
-- p_entry_id = NULL  → INSERT new entry
-- p_entry_id = <uuid> → UPDATE existing entry with optimistic lock on p_expected_version

CREATE OR REPLACE FUNCTION public.persist_draft_entry_atomic(
  p_entry_id           uuid,
  p_schedule_id        uuid,
  p_employee_id        uuid,
  p_date               date,
  p_expected_version   integer,
  p_day_type           text,
  p_start_time         text,
  p_end_time           text,
  p_split_start_time   text,
  p_split_end_time     text,
  p_zone_id            uuid,
  p_shift_template_id  uuid,
  p_changed_by         uuid,
  p_change_source      text,
  p_prev_day_type      text,
  p_prev_start_time    text,
  p_prev_end_time      text,
  p_prev_split_start   text,
  p_prev_split_end     text,
  p_prev_zone_id       uuid,
  p_prev_shift_tpl     uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_entry_id uuid;
  v_result   jsonb;
BEGIN
  IF p_entry_id IS NULL THEN
    INSERT INTO public.schedule_entries (
      schedule_id, employee_id, date,
      day_type, start_time, end_time,
      split_start_time, split_end_time,
      zone_id, shift_template_id,
      source, version
    )
    VALUES (
      p_schedule_id, p_employee_id, p_date,
      p_day_type, p_start_time, p_end_time,
      p_split_start_time, p_split_end_time,
      p_zone_id, p_shift_template_id,
      'manual', 1
    )
    RETURNING id INTO v_entry_id;
  ELSE
    UPDATE public.schedule_entries
    SET
      day_type          = p_day_type,
      start_time        = p_start_time,
      end_time          = p_end_time,
      split_start_time  = p_split_start_time,
      split_end_time    = p_split_end_time,
      zone_id           = p_zone_id,
      shift_template_id = p_shift_template_id,
      version           = p_expected_version + 1
    WHERE
      id      = p_entry_id
      AND version = p_expected_version
      AND source  = 'manual'
    RETURNING id INTO v_entry_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'SCHEDULE_ENTRY_CONFLICT: La celda fue actualizada por otro usuario o es de solo lectura.'
        USING ERRCODE = 'P0002';
    END IF;
  END IF;

  INSERT INTO public.schedule_entry_logs (
    schedule_entry_id,
    changed_by, change_source,
    previous_day_type, previous_start_time, previous_end_time,
    previous_split_start_time, previous_split_end_time,
    previous_zone_id, previous_shift_template_id,
    new_day_type, new_start_time, new_end_time,
    new_split_start_time, new_split_end_time,
    new_zone_id, new_shift_template_id
  )
  VALUES (
    v_entry_id,
    p_changed_by, p_change_source,
    p_prev_day_type, p_prev_start_time, p_prev_end_time,
    p_prev_split_start, p_prev_split_end,
    p_prev_zone_id, p_prev_shift_tpl,
    p_day_type, p_start_time, p_end_time,
    p_split_start_time, p_split_end_time,
    p_zone_id, p_shift_template_id
  );

  SELECT to_jsonb(se) INTO v_result
  FROM public.schedule_entries se
  WHERE se.id = v_entry_id;

  RETURN v_result;
END;
$$;

-- Service role (admin client) is the only caller; no authenticated-role grants needed.
REVOKE EXECUTE ON FUNCTION public.persist_draft_entry_atomic FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.persist_draft_entry_atomic TO service_role;
