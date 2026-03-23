import { z } from 'zod';

export const productSchema = z.object({
  created_at: z.string(),
  deleted_at: z.string().nullable().optional(),
  description: z.string().nullable(),
  is_active: z.boolean(),
  is_archived: z.boolean(),
  name: z.string(),
  product_id: z.string().uuid(),
  supplier_id: z.string().uuid(),
  unit: z.string().nullable(),
  updated_at: z.string(),
});

export type Product = z.infer<typeof productSchema>;

export const listProductsInputSchema = z.object({
  includeArchived: z.boolean().optional(),
  includeInactive: z.boolean().optional(),
  restaurantId: z.string().uuid().optional(),
  search: z.string().trim().min(1).max(120).optional(),
  supplierId: z.string().uuid().optional(),
});

export type ListProductsInput = z.infer<typeof listProductsInputSchema>;

export const createProductInputSchema = z.object({
  description: z.string().trim().max(600).nullable().optional(),
  isActive: z.boolean().optional(),
  name: z.string().trim().min(1).max(160),
  supplierId: z.string().uuid(),
  unit: z.string().trim().max(40).nullable().optional(),
});

export type CreateProductInput = z.infer<typeof createProductInputSchema>;
