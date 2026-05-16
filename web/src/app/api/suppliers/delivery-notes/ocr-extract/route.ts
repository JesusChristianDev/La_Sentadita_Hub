import { jsonError, jsonOk } from '@/app/api/_routeUtils';
import { getCurrentUserContext } from '@/modules/auth_users';
import { assertRestaurantAccess } from '@/shared/authz';
import { extractDeliveryNoteFromFile } from '@/modules/suppliers/application/mindeeExtractionService';
import { matchExtractedLinesToProducts } from '@/modules/suppliers/application/productMatchingService';
import { serverEnv } from '@/shared/env.server';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/tiff',
]);

export async function POST(request: Request) {
  if (!serverEnv.mindeeApiKey) {
    return jsonError('OCR_NOT_CONFIGURED', 503, {
      message: 'La extracción OCR no está configurada en este entorno.',
    });
  }

  const ctx = await getCurrentUserContext();
  if (!ctx) {
    return jsonError('UNAUTHORIZED', 401);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError('INVALID_FORM_DATA', 400);
  }

  const restaurantId = formData.get('restaurantId');
  if (typeof restaurantId !== 'string' || !restaurantId) {
    return jsonError('MISSING_RESTAURANT_ID', 400);
  }

  try {
    assertRestaurantAccess(ctx.requestContext, restaurantId);
  } catch {
    return jsonError('FORBIDDEN', 403);
  }

  const supplierId = formData.get('supplierId');
  const supplierIdStr =
    typeof supplierId === 'string' && supplierId.trim() ? supplierId.trim() : null;

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return jsonError('MISSING_FILE', 400, { message: 'Se requiere un archivo en el campo "file".' });
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return jsonError('INVALID_FILE_TYPE', 400, {
      allowed: [...ALLOWED_MIME_TYPES],
      message: `Tipo de archivo no soportado: ${file.type}`,
    });
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return jsonError('FILE_TOO_LARGE', 400, {
      maxBytes: MAX_FILE_SIZE_BYTES,
      message: 'El archivo supera el límite de 10 MB.',
    });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  let extraction;
  try {
    extraction = await extractDeliveryNoteFromFile(buffer, file.name);
  } catch (err) {
    console.error('[ocr-extract] Mindee error:', err);
    return jsonError('OCR_EXTRACTION_FAILED', 502, {
      message: err instanceof Error ? err.message : 'Error de extracción OCR.',
    });
  }

  if (!extraction) {
    return jsonError('OCR_NOT_CONFIGURED', 503);
  }

  let lines;
  try {
    lines = await matchExtractedLinesToProducts(extraction.lines, supplierIdStr);
  } catch (err) {
    console.error('[ocr-extract] Product matching error:', err);
    // Non-fatal: return lines without product IDs
    lines = extraction.lines.map((l) => ({
      isNewProduct: true,
      lineTotal: l.totalAmount ?? null,
      productId: null,
      productNameRaw: l.description.slice(0, 240),
      quantity: l.quantity ?? 1,
      taxAmount: l.taxAmount ?? null,
      taxRate: l.taxRate ?? null,
      unit: l.unit?.slice(0, 40) ?? null,
      unitPrice: l.unitPrice ?? null,
    }));
  }

  return jsonOk({
    deliveryDate: extraction.deliveryDate,
    documentNumber: extraction.documentNumber,
    lines,
    ocrRawJson: extraction.rawJson,
    supplierName: extraction.supplierName,
    taxAmount: extraction.taxAmount,
    totalAmount: extraction.totalAmount,
  });
}
