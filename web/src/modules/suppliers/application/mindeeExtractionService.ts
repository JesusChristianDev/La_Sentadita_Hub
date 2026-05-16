import 'server-only';

import { serverEnv } from '@/shared/env.server';

export type MindeeExtractedLine = {
  description: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  taxRate: number | null;
  taxAmount: number | null;
  totalAmount: number | null;
};

export type MindeeExtraction = {
  documentNumber: string | null;
  deliveryDate: string | null;
  supplierName: string | null;
  totalAmount: number | null;
  taxAmount: number | null;
  lines: MindeeExtractedLine[];
  rawJson: unknown;
};

function toFiniteNumberOrNull(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return Number.isFinite(value) ? value : null;
}

function toStringOrNull(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function extractDeliveryNoteFromFile(
  fileBuffer: Buffer,
  filename: string,
): Promise<MindeeExtraction | null> {
  const apiKey = serverEnv.mindeeApiKey;
  if (!apiKey) {
    return null;
  }

  // Dynamic import to avoid pulling Mindee into non-server bundles
  const mindee = await import('mindee');
  const client = new mindee.v1.Client({ apiKey });
  const inputSource = new mindee.BufferInput({ buffer: fileBuffer, filename });

  const response = await client.parse(
    mindee.v1.product.FinancialDocumentV1,
    inputSource,
  );

  const prediction = response.document.inference.prediction;
  const rawJson = JSON.parse(JSON.stringify(prediction)) as unknown;

  const lines: MindeeExtractedLine[] = (prediction.lineItems ?? []).map((item) => ({
    description: toStringOrNull(item.description) ?? 'Producto sin nombre',
    quantity: toFiniteNumberOrNull(item.quantity),
    taxAmount: toFiniteNumberOrNull(item.taxAmount),
    taxRate: toFiniteNumberOrNull(item.taxRate),
    totalAmount: toFiniteNumberOrNull(item.totalAmount),
    unit: toStringOrNull(item.unitMeasure),
    unitPrice: toFiniteNumberOrNull(item.unitPrice),
  }));

  // Sum taxes from lineItems if top-level taxes field is not populated
  const totalTax =
    toFiniteNumberOrNull(prediction.totalTax?.value ?? null) ??
    (lines.every((l) => l.taxAmount === null)
      ? null
      : lines.reduce((acc, l) => (acc ?? 0) + (l.taxAmount ?? 0), null as number | null));

  // Prefer invoiceNumber, fall back to documentNumber field
  const documentNumber =
    toStringOrNull(prediction.invoiceNumber?.value ?? null) ??
    toStringOrNull(prediction.documentNumber?.value ?? null);

  return {
    deliveryDate: toStringOrNull(prediction.date?.value ?? null),
    documentNumber,
    lines,
    rawJson,
    supplierName: toStringOrNull(prediction.supplierName?.value ?? null),
    taxAmount: totalTax,
    totalAmount: toFiniteNumberOrNull(prediction.totalAmount?.value ?? null),
  };
}
