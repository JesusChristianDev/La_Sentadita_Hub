begin;

-- ============================================================
-- 023_canon_v9_delivery_notes_update_policy_cleanup
-- Consolidate delivery_notes UPDATE policies into a single
-- permissive policy to remove advisor noise and keep semantics.
-- ============================================================

drop policy if exists delivery_notes_update_confirm_extraction_canon on public.delivery_notes;
drop policy if exists delivery_notes_update_validate_canon on public.delivery_notes;
drop policy if exists delivery_notes_update_canon on public.delivery_notes;

create policy delivery_notes_update_canon
on public.delivery_notes
for update
to authenticated
using (
  public.current_user_can_view_delivery_note_row(
    restaurant_id,
    uploaded_by,
    reviewed_by_employee
  )
)
with check (
  public.current_user_can_confirm_delivery_note_extraction(
    delivery_note_id,
    restaurant_id,
    status,
    uploaded_by,
    reviewed_by_employee,
    employee_reviewed_at,
    reviewed_by_office,
    office_reviewed_at,
    confirmed_at,
    rejection_reason
  )
  or public.current_user_can_validate_delivery_note(
    delivery_note_id,
    restaurant_id,
    status,
    uploaded_by,
    reviewed_by_office,
    office_reviewed_at,
    confirmed_at,
    rejection_reason
  )
);

commit;
