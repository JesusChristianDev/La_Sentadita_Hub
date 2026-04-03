import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { assertRestaurantAccess } from '@/shared/authz';

import {
  type DeliveryNote,
  type DeliveryNoteLine,
  deliveryNoteLineSchema,
  deliveryNoteSchema,
} from '../domain/deliveryNoteTypes';
import { getModuleContext, getRestaurantScopeOrThrow } from './internal';

export async function listDeliveryNotes(
  input: { restaurantId?: string } = {},
): Promise<DeliveryNote[]> {
  const { admin, requestContext } = await getModuleContext();
  const restaurantScope = await getRestaurantScopeOrThrow(
    admin,
    requestContext,
    input.restaurantId,
  );

  assertRestaurantAccess(requestContext, restaurantScope.restaurantId);

  const { data, error } = await admin
    .from('delivery_notes')
    .select(
      'delivery_note_id, restaurant_id, supplier_id, document_id, document_number, delivery_date, status, ocr_raw_json, uploaded_by, reviewed_by_employee, employee_reviewed_at, reviewed_by_office, office_reviewed_at, confirmed_at, rejection_reason, total_amount, tax_amount, created_at, updated_at',
    )
    .eq('restaurant_id', restaurantScope.restaurantId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to list delivery notes: ${error.message}`);
  }

  return (data ?? []).map((row) => deliveryNoteSchema.parse(row));
}

export async function getDeliveryNoteWithLines(
  deliveryNoteId: string,
): Promise<{ deliveryNote: DeliveryNote; lines: DeliveryNoteLine[] }> {
  const { requestContext } = await getModuleContext();
  const admin = createSupabaseAdminClient();
  const { data: noteData, error: noteError } = await admin
    .from('delivery_notes')
    .select(
      'delivery_note_id, restaurant_id, supplier_id, document_id, document_number, delivery_date, status, ocr_raw_json, uploaded_by, reviewed_by_employee, employee_reviewed_at, reviewed_by_office, office_reviewed_at, confirmed_at, rejection_reason, total_amount, tax_amount, created_at, updated_at',
    )
    .eq('delivery_note_id', deliveryNoteId)
    .single();

  if (noteError) {
    throw new Error(`Failed to load delivery note: ${noteError.message}`);
  }

  assertRestaurantAccess(requestContext, noteData.restaurant_id);

  const { data: linesData, error: linesError } = await admin
    .from('delivery_note_lines')
    .select(
      'line_id, delivery_note_id, product_id, product_name_raw, quantity, unit, unit_price, tax_rate, tax_amount, line_total, is_new_product, created_at, updated_at',
    )
    .eq('delivery_note_id', deliveryNoteId)
    .order('created_at', { ascending: true });

  if (linesError) {
    throw new Error(`Failed to load delivery note lines: ${linesError.message}`);
  }

  return {
    deliveryNote: deliveryNoteSchema.parse(noteData),
    lines: (linesData ?? []).map((row) => deliveryNoteLineSchema.parse(row)),
  };
}
