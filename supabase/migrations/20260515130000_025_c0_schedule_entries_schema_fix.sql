-- Migration 025: Phase C — Fix schedule_entries schema misalignment
--
-- Problem: Code uses (employee_id, date, version) but DB only has
--   (employment_id, entry_date). Three columns missing; trigger was broken
--   (referenced er.restaurant_id / er.active_principal — columns that don't
--   exist in employment_relationships). Current live trigger is a validator
--   that blocks backfill because valid_during is NULL on some rows.
--
-- Strategy:
--   1. Disable the trigger during DDL changes
--   2. Add missing columns: employee_id, date, version
--   3. Backfill date ← entry_date for existing rows
--   4. Drop old unique constraint; add scoped one matching code's upsert key
--   5. Replace trigger: auto-populate employment_id from employee_id,
--      keep date ↔ entry_date in sync, validate only on INSERT
--   6. Re-enable trigger

ALTER TABLE public.schedule_entries
  DISABLE TRIGGER trg_schedule_entries_sync_employment_id;

-- ─────────────────────────────────────────────────
-- 1. Add missing columns
-- ─────────────────────────────────────────────────

ALTER TABLE public.schedule_entries
  ADD COLUMN IF NOT EXISTS employee_id uuid
    REFERENCES public.persons(person_id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS "date" date,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 0;

-- ─────────────────────────────────────────────────
-- 2. Backfill: date ← entry_date for existing rows
-- ─────────────────────────────────────────────────

UPDATE public.schedule_entries
   SET "date" = entry_date
 WHERE "date" IS NULL;

ALTER TABLE public.schedule_entries
  ALTER COLUMN "date" SET NOT NULL;

-- ─────────────────────────────────────────────────
-- 3. Replace unique constraint
--    Old: UNIQUE(employment_id, entry_date) — wrong scope for multi-schedule
--    New: UNIQUE(schedule_id, employee_id, date) — matches code upsert key
-- ─────────────────────────────────────────────────

ALTER TABLE public.schedule_entries
  DROP CONSTRAINT IF EXISTS schedule_entries_employment_id_entry_date_key;

DROP INDEX IF EXISTS ux_schedule_entries_schedule_employee_date;
CREATE UNIQUE INDEX ux_schedule_entries_schedule_employee_date
  ON public.schedule_entries(schedule_id, employee_id, "date")
  WHERE employee_id IS NOT NULL;

-- ─────────────────────────────────────────────────
-- 4. Replace trigger function
--    Fixed: uses employment_restaurant_assignments (correct v9 schema)
--    Added: auto-populate employment_id from employee_id on INSERT
--    Added: keep date ↔ entry_date in sync
--    Validation only on INSERT (not UPDATE, to allow edits without re-validating employment range)
-- ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.sync_schedule_entry_employment_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_restaurant_id uuid;
BEGIN
  -- Keep date ↔ entry_date in sync (both columns coexist during v8→v9 transition)
  IF NEW."date" IS NOT NULL THEN
    NEW.entry_date := NEW."date";
  ELSIF NEW.entry_date IS NOT NULL THEN
    NEW."date" := NEW.entry_date;
  END IF;

  IF NEW.schedule_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT s.restaurant_id INTO v_restaurant_id
    FROM public.schedules s
   WHERE s.id = NEW.schedule_id;

  -- Validate zone belongs to this restaurant (INSERT + UPDATE)
  IF NEW.zone_id IS NOT NULL AND v_restaurant_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.restaurant_zones rz
       WHERE rz.id = NEW.zone_id AND rz.restaurant_id = v_restaurant_id
    ) THEN
      RAISE EXCEPTION 'schedule entry zone must belong to the schedule restaurant';
    END IF;
  END IF;

  -- Auto-populate employment_id from employee_id (person reference) when provided
  IF NEW.employee_id IS NOT NULL AND v_restaurant_id IS NOT NULL
     AND (NEW.employment_id IS NULL OR TG_OP = 'INSERT') THEN
    SELECT er.employment_id INTO NEW.employment_id
      FROM public.employment_relationships er
      JOIN public.employment_restaurant_assignments era
        ON era.employment_id = er.employment_id
       AND era.restaurant_id = v_restaurant_id
       AND (era.valid_to IS NULL OR era.valid_to >= COALESCE(NEW."date", NEW.entry_date))
     WHERE er.person_id = NEW.employee_id
       AND er.is_archived = false
       AND (er.valid_to IS NULL OR er.valid_to >= COALESCE(NEW."date", NEW.entry_date))
     ORDER BY er.valid_from DESC
     LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$;

ALTER TABLE public.schedule_entries
  ENABLE TRIGGER trg_schedule_entries_sync_employment_id;
