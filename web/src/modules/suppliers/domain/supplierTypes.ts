import { z } from 'zod';

export type SupplierScopeType = 'organization' | 'restaurant';
export type SupplierScope = SupplierScopeType;

export type DeliveryNoteStatus =
  | 'uploaded'
  | 'employee_reviewed'
  | 'office_reviewing'
  | 'confirmed'
  | 'rejected';

export type SupplierRecord = {
  contact_email: string | null;
  contact_phone: string | null;
  created_at: string;
  deleted_at: string | null;
  is_active: boolean;
  is_archived: boolean;
  name: string;
  scope_id: string;
  scope_type: SupplierScopeType;
  supplier_id: string;
  tax_id: string | null;
  updated_at: string;
};

export type ProductRecord = {
  created_at: string;
  deleted_at: string | null;
  description: string | null;
  is_active: boolean;
  is_archived: boolean;
  name: string;
  product_id: string;
  supplier_id: string;
  unit: string | null;
  updated_at: string;
};

export type DeliveryNoteLineRecord = {
  created_at: string;
  delivery_note_id: string;
  is_new_product: boolean;
  line_id: string;
  line_total: number | null;
  product_id: string | null;
  product_name_raw: string;
  quantity: number;
  tax_amount: number | null;
  tax_rate: number | null;
  unit: string | null;
  unit_price: number | null;
  updated_at: string;
};

export type DeliveryNoteRecord = {
  confirmed_at: string | null;
  created_at: string;
  delivery_date: string | null;
  delivery_note_id: string;
  document_id: string | null;
  document_number: string | null;
  employee_reviewed_at: string | null;
  ocr_raw_json: unknown;
  office_reviewed_at: string | null;
  rejection_reason: string | null;
  restaurant_id: string;
  reviewed_by_employee: string | null;
  reviewed_by_office: string | null;
  status: DeliveryNoteStatus;
  supplier_id: string | null;
  tax_amount: number | null;
  total_amount: number | null;
  updated_at: string;
  uploaded_by: string;
};

export type CreateSupplierInput = {
  contactEmail?: string | null;
  contactPhone?: string | null;
  isActive?: boolean;
  name: string;
  scopeId: string;
  scopeType: SupplierScopeType;
  taxId?: string | null;
};

export type CreateProductInput = {
  description?: string | null;
  name: string;
  supplierId: string;
  unit?: string | null;
};

export type CreateDeliveryNoteInput = {
  deliveryDate?: string | null;
  documentNumber?: string | null;
  fileUrl: string;
  lines: Array<{
    isNewProduct?: boolean;
    lineTotal?: number | null;
    productId?: string | null;
    productNameRaw: string;
    quantity: number;
    taxAmount?: number | null;
    taxRate?: number | null;
    unit?: string | null;
    unitPrice?: number | null;
  }>;
  ocrRawJson?: unknown;
  restaurantId: string;
  supplierId?: string | null;
  taxAmount?: number | null;
  totalAmount?: number | null;
};

export type Supplier = SupplierRecord;

export const supplierScopeSchema = z.enum(['organization', 'restaurant']);

export const supplierSchema = z.object({
  contact_email: z.string().nullable(),
  contact_phone: z.string().nullable(),
  created_at: z.string(),
  deleted_at: z.string().nullable(),
  is_active: z.boolean(),
  is_archived: z.boolean(),
  name: z.string(),
  scope_id: z.string().uuid(),
  scope_type: supplierScopeSchema,
  supplier_id: z.string().uuid(),
  tax_id: z.string().nullable(),
  updated_at: z.string(),
});

export const createSupplierInputSchema = z.object({
  contactEmail: z.string().email().nullable().optional(),
  contactPhone: z.string().trim().max(80).nullable().optional(),
  isActive: z.boolean().optional(),
  name: z.string().trim().min(1).max(160),
  scopeId: z.string().uuid(),
  scopeType: supplierScopeSchema,
  taxId: z.string().trim().max(80).nullable().optional(),
});

export const listSuppliersInputSchema = z.object({
  includeArchived: z.boolean().optional(),
  includeInactive: z.boolean().optional(),
  restaurantId: z.string().uuid().optional(),
  scopeId: z.string().uuid().optional(),
  scopeType: supplierScopeSchema.optional(),
  search: z.string().trim().min(1).max(120).optional(),
});

export type ListSuppliersInput = z.infer<typeof listSuppliersInputSchema>;
