import 'server-only';

import type { ZodType } from 'zod';

import type { AuditAction, AuditJsonValue, AuditScopeType } from '@/modules/audit';
import { AUDIT_ACTIONS, writeAuditLog } from '@/modules/audit';
import { getCurrentUserContext } from '@/modules/auth_users';
import { assertRestaurantAccess, canManageRestaurant, isGlobalSystemRole, type RequestContext } from '@/modules/authz';
import { createSupabaseAdminClient } from '@/shared/supabase/admin';

import { type CreateDeliveryNoteLineInput, type DeliveryNote, type DeliveryNoteLine, deliveryNoteLineSchema, deliveryNoteSchema, type DeliveryNoteStatus } from '../domain/deliveryNoteTypes';
import { type Product,productSchema } from '../domain/productTypes';
import { type Supplier, supplierSchema, type SupplierScope } from '../domain/supplierTypes';

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;

type RestaurantRow = {
  company_id: string;
  id: string;
};

type OrganizationScopeRow = {
  organization_id: string;
};

type CompanyScopeRow = {
  organization_id: string;
};

export type ModuleContext = {
  admin: SupabaseAdminClient;
  requestContext: RequestContext;
};

export type RestaurantScope = {
  organizationId: string;
  restaurantId: string;
};

function parseRow<T>(schema: ZodType<T>, row: unknown, label: string): T {
  const parsed = schema.safeParse(row);
  if (parsed.success) return parsed.data;
  throw new Error(`INVALID_${label.toUpperCase()}_ROW`);
}

function parseRows<T>(schema: ZodType<T>, rows: unknown[], label: string): T[] {
  return rows.map((row) => parseRow(schema, row, label));
}

function normalizeReason(reason?: string | null): string | null {
  const trimmed = reason?.trim();
  return trimmed ? trimmed : null;
}

function throwSupabaseError(prefix: string, error: { message?: string } | null): never {
  throw new Error(`${prefix}: ${error?.message ?? 'Unknown database error'}`);
}

export async function getModuleContext(): Promise<ModuleContext> {
  const currentUser = await getCurrentUserContext();
  if (!currentUser) {
    throw new Error('UNAUTHENTICATED');
  }

  return {
    admin: createSupabaseAdminClient(),
    requestContext: currentUser.requestContext,
  };
}

async function getRestaurantScopeById(
  admin: SupabaseAdminClient,
  restaurantId: string,
): Promise<RestaurantScope> {
  const { data: restaurantData, error: restaurantError } = await admin
    .from('restaurants')
    .select('id, company_id')
    .eq('id', restaurantId)
    .limit(1)
    .maybeSingle<RestaurantRow>();

  if (restaurantError) {
    throwSupabaseError('Failed to resolve restaurant scope', restaurantError);
  }

  if (!restaurantData?.id || !restaurantData.company_id) {
    throw new Error('RESTAURANT_NOT_FOUND');
  }

  const { data: companyData, error: companyError } = await admin
    .from('companies')
    .select('organization_id')
    .eq('company_id', restaurantData.company_id)
    .limit(1)
    .maybeSingle<CompanyScopeRow>();

  if (companyError) {
    throwSupabaseError('Failed to resolve company scope', companyError);
  }

  if (!companyData?.organization_id) {
    throw new Error('RESTAURANT_NOT_FOUND');
  }

  return {
    organizationId: companyData.organization_id,
    restaurantId: restaurantData.id,
  };
}

export async function getRestaurantScopeOrThrow(
  admin: SupabaseAdminClient,
  ctx: RequestContext,
  requestedRestaurantId?: string | null,
): Promise<RestaurantScope> {
  const restaurantId =
    requestedRestaurantId ?? ctx.effectiveRestaurantId ?? ctx.restaurantId;

  if (!restaurantId) {
    throw new Error('RESTAURANT_REQUIRED');
  }

  assertRestaurantAccess(
    ctx,
    restaurantId,
    'FORBIDDEN: No puedes operar sobre otro restaurante.',
  );

  return getRestaurantScopeById(admin, restaurantId);
}

export async function assertSupplierScopeExists(
  admin: SupabaseAdminClient,
  scopeType: SupplierScope,
  scopeId: string,
): Promise<void> {
  if (scopeType === 'organization') {
    const { data, error } = await admin
      .from('organizations')
      .select('organization_id')
      .eq('organization_id', scopeId)
      .limit(1)
      .maybeSingle<OrganizationScopeRow>();

    if (error) {
      throwSupabaseError('Failed to validate organization scope', error);
    }

    if (!data?.organization_id) {
      throw new Error('ORGANIZATION_SCOPE_NOT_FOUND');
    }

    return;
  }

  await getRestaurantScopeById(admin, scopeId);
}

export function requireGlobalBackofficeRole(
  ctx: RequestContext,
  message = 'FORBIDDEN: Solo office o admin pueden realizar esta accion.',
): void {
  if (ctx.systemRole === 'admin' || ctx.systemRole === 'office') return;
  throw new Error(message);
}

export async function getSupplierOrThrow(
  admin: SupabaseAdminClient,
  supplierId: string,
): Promise<Supplier> {
  const { data, error } = await admin
    .from('suppliers')
    .select('*')
    .eq('supplier_id', supplierId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throwSupabaseError('Failed to load supplier', error);
  }

  if (!data) {
    throw new Error('SUPPLIER_NOT_FOUND');
  }

  return parseRow(supplierSchema, data, 'supplier');
}

export async function assertSupplierActiveForMutation(
  admin: SupabaseAdminClient,
  supplierId: string,
): Promise<Supplier> {
  const supplier = await getSupplierOrThrow(admin, supplierId);
  if (supplier.is_archived) {
    throw new Error('SUPPLIER_ARCHIVED');
  }

  return supplier;
}

export function assertSupplierVisibleForRestaurant(
  supplier: Supplier,
  restaurantScope: RestaurantScope,
): void {
  if (supplier.scope_type === 'restaurant') {
    if (supplier.scope_id === restaurantScope.restaurantId) return;
    throw new Error('SUPPLIER_OUT_OF_SCOPE');
  }

  if (supplier.scope_id === restaurantScope.organizationId) return;
  throw new Error('SUPPLIER_OUT_OF_SCOPE');
}

export async function assertSupplierAccessible(
  admin: SupabaseAdminClient,
  ctx: RequestContext,
  supplier: Supplier,
  requestedRestaurantId?: string | null,
): Promise<void> {
  if (isGlobalSystemRole(ctx)) return;

  const restaurantScope = await getRestaurantScopeOrThrow(
    admin,
    ctx,
    requestedRestaurantId,
  );
  assertSupplierVisibleForRestaurant(supplier, restaurantScope);
}

export async function listVisibleSuppliersForRestaurant(
  admin: SupabaseAdminClient,
  restaurantScope: RestaurantScope,
  input: {
    includeArchived?: boolean;
    includeInactive?: boolean;
    search?: string;
  },
): Promise<Supplier[]> {
  let restaurantQuery = admin
    .from('suppliers')
    .select('*')
    .eq('scope_type', 'restaurant')
    .eq('scope_id', restaurantScope.restaurantId)
    .order('name', { ascending: true });

  let organizationQuery = admin
    .from('suppliers')
    .select('*')
    .eq('scope_type', 'organization')
    .eq('scope_id', restaurantScope.organizationId)
    .order('name', { ascending: true });

  if (!input.includeArchived) {
    restaurantQuery = restaurantQuery.eq('is_archived', false);
    organizationQuery = organizationQuery.eq('is_archived', false);
  }

  if (!input.includeInactive) {
    restaurantQuery = restaurantQuery.eq('is_active', true);
    organizationQuery = organizationQuery.eq('is_active', true);
  }

  if (input.search) {
    restaurantQuery = restaurantQuery.ilike('name', `%${input.search}%`);
    organizationQuery = organizationQuery.ilike('name', `%${input.search}%`);
  }

  const [restaurantResult, organizationResult] = await Promise.all([
    restaurantQuery,
    organizationQuery,
  ]);

  if (restaurantResult.error) {
    throwSupabaseError('Failed to list restaurant suppliers', restaurantResult.error);
  }

  if (organizationResult.error) {
    throwSupabaseError('Failed to list organization suppliers', organizationResult.error);
  }

  const deduped = new Map<string, Supplier>();
  for (const supplier of [
    ...parseRows(supplierSchema, restaurantResult.data ?? [], 'supplier'),
    ...parseRows(supplierSchema, organizationResult.data ?? [], 'supplier'),
  ]) {
    deduped.set(supplier.supplier_id, supplier);
  }

  return [...deduped.values()].sort((left, right) => left.name.localeCompare(right.name));
}

export async function listAllSupplierIds(
  admin: SupabaseAdminClient,
  input: {
    includeArchived?: boolean;
    includeInactive?: boolean;
    search?: string;
  },
): Promise<string[]> {
  let query = admin
    .from('suppliers')
    .select('supplier_id')
    .order('name', { ascending: true });

  if (!input.includeArchived) query = query.eq('is_archived', false);
  if (!input.includeInactive) query = query.eq('is_active', true);
  if (input.search) query = query.ilike('name', `%${input.search}%`);

  const { data, error } = await query;
  if (error) {
    throwSupabaseError('Failed to list supplier ids', error);
  }

  return (data ?? [])
    .map((row) => row?.supplier_id)
    .filter((value): value is string => typeof value === 'string');
}

export async function listProductsBySupplierIds(
  admin: SupabaseAdminClient,
  supplierIds: string[],
  input: {
    includeArchived?: boolean;
    includeInactive?: boolean;
    search?: string;
  },
): Promise<Product[]> {
  if (supplierIds.length === 0) return [];

  let query = admin
    .from('products')
    .select('*')
    .in('supplier_id', supplierIds)
    .order('name', { ascending: true });

  if (!input.includeArchived) query = query.eq('is_archived', false);
  if (!input.includeInactive) query = query.eq('is_active', true);
  if (input.search) query = query.ilike('name', `%${input.search}%`);

  const { data, error } = await query;
  if (error) {
    throwSupabaseError('Failed to list products', error);
  }

  return parseRows(productSchema, data ?? [], 'product');
}

export async function getDeliveryNoteOrThrow(
  admin: SupabaseAdminClient,
  deliveryNoteId: string,
): Promise<DeliveryNote> {
  const { data, error } = await admin
    .from('delivery_notes')
    .select('*')
    .eq('delivery_note_id', deliveryNoteId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throwSupabaseError('Failed to load delivery note', error);
  }

  if (!data) {
    throw new Error('DELIVERY_NOTE_NOT_FOUND');
  }

  return parseRow(deliveryNoteSchema, data, 'delivery_note');
}

export async function insertDeliveryNoteLines(
  admin: SupabaseAdminClient,
  deliveryNoteId: string,
  lines: CreateDeliveryNoteLineInput[],
): Promise<DeliveryNoteLine[]> {
  const payload = lines.map((line) => ({
    delivery_note_id: deliveryNoteId,
    is_new_product: line.isNewProduct ?? false,
    line_total: line.lineTotal ?? null,
    product_id: line.productId ?? null,
    product_name_raw: line.productNameRaw,
    quantity: line.quantity,
    tax_amount: line.taxAmount ?? null,
    tax_rate: line.taxRate ?? null,
    unit: line.unit ?? null,
    unit_price: line.unitPrice ?? null,
  }));

  const { data, error } = await admin
    .from('delivery_note_lines')
    .insert(payload)
    .select('*');

  if (error) {
    throwSupabaseError('Failed to insert delivery note lines', error);
  }

  return parseRows(deliveryNoteLineSchema, data ?? [], 'delivery_note_line');
}

export async function deleteDeliveryNoteOrThrow(
  admin: SupabaseAdminClient,
  deliveryNoteId: string,
): Promise<void> {
  const { error } = await admin
    .from('delivery_notes')
    .delete()
    .eq('delivery_note_id', deliveryNoteId);

  if (error) {
    throwSupabaseError('Failed to rollback delivery note', error);
  }
}

export async function logAuditOrThrow(input: {
  action: AuditAction;
  entityId: string;
  entityType: string;
  newValue?: AuditJsonValue;
  previousValue?: AuditJsonValue;
  reason?: string | null;
  scopeId?: string | null;
  scopeType?: AuditScopeType | null;
  traceId?: string | null;
}): Promise<void> {
  const result = await writeAuditLog({
    action: input.action,
    entityId: input.entityId,
    entityType: input.entityType,
    newValue: input.newValue,
    previousValue: input.previousValue,
    reason: normalizeReason(input.reason),
    scopeId: input.scopeId,
    scopeType: input.scopeType,
    traceId: input.traceId,
  });

  if (result.status === 'success' || result.status === 'unavailable') {
    return;
  }

  throw new Error(`AUDIT_LOG_FAILED: ${result.error}`);
}

export async function assertCanCreateDeliveryNote(
  admin: SupabaseAdminClient,
  ctx: RequestContext,
  requestedRestaurantId?: string | null,
): Promise<RestaurantScope> {
  return getRestaurantScopeOrThrow(admin, ctx, requestedRestaurantId);
}

export function assertCanReviewDeliveryNote(
  ctx: RequestContext,
  note: DeliveryNote,
): void {
  if (ctx.personId === note.uploaded_by) return;
  if (ctx.systemRole === 'admin' || ctx.systemRole === 'office') return;
  if (canManageRestaurant(ctx, note.restaurant_id)) return;

  throw new Error('FORBIDDEN: No puedes revisar este albaran.');
}

export function assertCanFinalizeDeliveryNote(ctx: RequestContext): void {
  requireGlobalBackofficeRole(
    ctx,
    'FORBIDDEN: Solo office o admin pueden confirmar o rechazar albaranes.',
  );
}

export function assertReviewableStatus(status: DeliveryNoteStatus): void {
  if (status === 'uploaded') return;
  throw new Error('DELIVERY_NOTE_REVIEW_NOT_ALLOWED');
}

export function assertFinalizableStatus(status: DeliveryNoteStatus): void {
  if (status === 'employee_reviewed' || status === 'office_reviewing') return;
  throw new Error('DELIVERY_NOTE_FINALIZATION_NOT_ALLOWED');
}

export function getSupplierAuditScope(
  supplier: Pick<Supplier, 'scope_id' | 'scope_type'>,
): { scopeId: string; scopeType: AuditScopeType } {
  return {
    scopeId: supplier.scope_id,
    scopeType: supplier.scope_type,
  };
}

export function getRestaurantAuditScope(
  restaurantId: string,
): { scopeId: string; scopeType: AuditScopeType } {
  return {
    scopeId: restaurantId,
    scopeType: 'restaurant',
  };
}

export async function maybeMarkOfficeReviewingBeforeFinalize(
  admin: SupabaseAdminClient,
  note: DeliveryNote,
  actorId: string,
): Promise<DeliveryNote> {
  if (note.status !== 'employee_reviewed') {
    return note;
  }

  const { data, error } = await admin
    .from('delivery_notes')
    .update({
      office_reviewed_at: new Date().toISOString(),
      reviewed_by_office: actorId,
      status: 'office_reviewing',
    })
    .eq('delivery_note_id', note.delivery_note_id)
    .select('*')
    .limit(1)
    .maybeSingle();

  if (error) {
    throwSupabaseError('Failed to move delivery note to office_reviewing', error);
  }

  if (!data) {
    throw new Error('DELIVERY_NOTE_NOT_FOUND');
  }

  return parseRow(deliveryNoteSchema, data, 'delivery_note');
}

export async function ensureSupplierFitsRestaurant(
  admin: SupabaseAdminClient,
  supplierId: string | null | undefined,
  restaurantScope: RestaurantScope,
): Promise<Supplier | null> {
  if (!supplierId) return null;

  const supplier = await assertSupplierActiveForMutation(admin, supplierId);
  assertSupplierVisibleForRestaurant(supplier, restaurantScope);
  return supplier;
}

export const supplierAuditActions = {
  confirmDeliveryNote: AUDIT_ACTIONS.deliveryNoteOfficeConfirmed,
  create: AUDIT_ACTIONS.supplierCreated,
  createProduct: AUDIT_ACTIONS.productCreated,
  rejectDeliveryNote: AUDIT_ACTIONS.deliveryNoteOfficeRejected,
  reviewDeliveryNote: AUDIT_ACTIONS.deliveryNoteEmployeeReviewed,
  uploadDeliveryNote: AUDIT_ACTIONS.deliveryNoteUploaded,
} as const;
