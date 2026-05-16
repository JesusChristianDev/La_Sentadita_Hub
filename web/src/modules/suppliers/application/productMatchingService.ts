import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';

import type { MindeeExtractedLine } from './mindeeExtractionService';
import type { CreateDeliveryNoteLineInput } from '../domain/deliveryNoteTypes';

type AliasRow = {
  product_id: string;
  raw_text: string;
};

function normalizeText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

export async function matchExtractedLinesToProducts(
  lines: MindeeExtractedLine[],
  supplierId: string | null,
): Promise<CreateDeliveryNoteLineInput[]> {
  if (lines.length === 0) return [];

  const admin = createSupabaseAdminClient();

  // Load aliases for this supplier (or global aliases if no supplier)
  let query = admin
    .from('supplier_product_aliases')
    .select('raw_text, product_id');

  if (supplierId) {
    query = query.eq('supplier_id', supplierId);
  }

  const { data: aliases, error } = await query;
  if (error) {
    // Non-fatal: fall back to unmatched lines
    console.warn('[productMatchingService] Failed to load aliases:', error.message);
  }

  const aliasMap = new Map<string, string>();
  for (const alias of (aliases ?? []) as AliasRow[]) {
    aliasMap.set(normalizeText(alias.raw_text), alias.product_id);
  }

  return lines.map((line) => {
    const normalizedDesc = normalizeText(line.description);
    const productId = aliasMap.get(normalizedDesc) ?? null;

    return {
      isNewProduct: productId === null,
      lineTotal: line.totalAmount ?? null,
      productId,
      productNameRaw: line.description.slice(0, 240),
      quantity: line.quantity ?? 1,
      taxAmount: line.taxAmount ?? null,
      taxRate: line.taxRate ?? null,
      unit: line.unit?.slice(0, 40) ?? null,
      unitPrice: line.unitPrice ?? null,
    };
  });
}
