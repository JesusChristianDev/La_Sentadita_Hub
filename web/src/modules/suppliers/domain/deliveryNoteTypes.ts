import { z } from 'zod';

const numericValueSchema = z.union([
  z.number().finite(),
  z
    .string()
    .trim()
    .regex(/^-?\d+(\.\d+)?$/)
    .transform(Number),
]);

const nullableNumericValueSchema = z.union([numericValueSchema, z.null()]);

export const deliveryNoteStatusSchema = z.enum([
  'uploaded',
  'employee_reviewed',
  'office_reviewing',
  'confirmed',
  'rejected',
]);

export type DeliveryNoteStatus = z.infer<typeof deliveryNoteStatusSchema>;

export const deliveryNoteLineSchema = z.object({
  created_at: z.string(),
  delivery_note_id: z.string().uuid(),
  is_new_product: z.boolean(),
  line_id: z.string().uuid(),
  line_total: nullableNumericValueSchema.transform((value) =>
    value === null ? null : value,
  ),
  product_id: z.string().uuid().nullable(),
  product_name_raw: z.string(),
  quantity: numericValueSchema,
  tax_amount: nullableNumericValueSchema.transform((value) =>
    value === null ? null : value,
  ),
  tax_rate: nullableNumericValueSchema.transform((value) =>
    value === null ? null : value,
  ),
  unit: z.string().nullable(),
  unit_price: nullableNumericValueSchema.transform((value) =>
    value === null ? null : value,
  ),
  updated_at: z.string(),
});

export type DeliveryNoteLine = z.infer<typeof deliveryNoteLineSchema>;

export const deliveryNoteSchema = z.object({
  confirmed_at: z.string().nullable(),
  created_at: z.string(),
  delivery_date: z.string().nullable(),
  delivery_note_id: z.string().uuid(),
  document_id: z.string().uuid().nullable(),
  document_number: z.string().nullable(),
  employee_reviewed_at: z.string().nullable(),
  ocr_raw_json: z.unknown().nullable(),
  office_reviewed_at: z.string().nullable(),
  rejection_reason: z.string().nullable(),
  restaurant_id: z.string().uuid(),
  reviewed_by_employee: z.string().uuid().nullable(),
  reviewed_by_office: z.string().uuid().nullable(),
  status: deliveryNoteStatusSchema,
  supplier_id: z.string().uuid().nullable(),
  tax_amount: nullableNumericValueSchema.transform((value) =>
    value === null ? null : value,
  ),
  total_amount: nullableNumericValueSchema.transform((value) =>
    value === null ? null : value,
  ),
  updated_at: z.string(),
  uploaded_by: z.string().uuid(),
});

export type DeliveryNote = z.infer<typeof deliveryNoteSchema>;

export const deliveryNoteWithLinesSchema = deliveryNoteSchema.extend({
  lines: z.array(deliveryNoteLineSchema),
});

export type DeliveryNoteWithLines = z.infer<typeof deliveryNoteWithLinesSchema>;

export const createDeliveryNoteLineInputSchema = z.object({
  isNewProduct: z.boolean().optional(),
  lineTotal: z.number().finite().nullable().optional(),
  productId: z.string().uuid().nullable().optional(),
  productNameRaw: z.string().trim().min(1).max(240),
  quantity: z.number().finite().positive(),
  taxAmount: z.number().finite().nullable().optional(),
  taxRate: z.number().finite().nullable().optional(),
  unit: z.string().trim().max(40).nullable().optional(),
  unitPrice: z.number().finite().nullable().optional(),
});

export type CreateDeliveryNoteLineInput = z.infer<
  typeof createDeliveryNoteLineInputSchema
>;

export const createDeliveryNoteInputSchema = z.object({
  deliveryDate: z.string().trim().min(1).max(20).nullable().optional(),
  documentId: z.string().uuid().nullable().optional(),
  documentNumber: z.string().trim().max(80).nullable().optional(),
  lines: z.array(createDeliveryNoteLineInputSchema).min(1),
  ocrRawJson: z.unknown().optional(),
  restaurantId: z.string().uuid().optional(),
  supplierId: z.string().uuid().nullable().optional(),
  taxAmount: z.number().finite().nullable().optional(),
  totalAmount: z.number().finite().nullable().optional(),
});

export type CreateDeliveryNoteInput = z.infer<
  typeof createDeliveryNoteInputSchema
>;

export const reviewDeliveryNoteInputSchema = z.object({
  deliveryNoteId: z.string().uuid(),
});

export type ReviewDeliveryNoteInput = z.infer<
  typeof reviewDeliveryNoteInputSchema
>;

export const confirmDeliveryNoteInputSchema = z.object({
  deliveryNoteId: z.string().uuid(),
});

export type ConfirmDeliveryNoteInput = z.infer<
  typeof confirmDeliveryNoteInputSchema
>;

export const rejectDeliveryNoteInputSchema = z.object({
  deliveryNoteId: z.string().uuid(),
  rejectionReason: z.string().trim().min(1).max(600),
});

export type RejectDeliveryNoteInput = z.infer<
  typeof rejectDeliveryNoteInputSchema
>;
