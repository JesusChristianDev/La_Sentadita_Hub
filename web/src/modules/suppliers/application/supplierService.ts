import 'server-only';

import { AUDIT_ACTIONS, writeAuditLog } from '@/modules/audit';
import { getCurrentUserContext } from '@/modules/auth_users';
import {
  assertRestaurantAccess,
  isGlobalSystemRole,
} from '@/modules/authz';
import type { SystemRole } from '@/modules/authz/domain/systemRoles';
import { notifyPeople, notifyPerson } from '@/modules/notifications';
import { createSupabaseAdminClient } from '@/shared/supabase/admin';

import type {
  CreateDeliveryNoteInput,
  CreateProductInput,
  CreateSupplierInput,
  DeliveryNoteLineRecord,
  DeliveryNoteRecord,
  ProductRecord,
  SupplierRecord,
} from '../domain/supplierTypes';

async function getRequiredCurrentUserContext() {
  const ctx = await getCurrentUserContext();
  if (!ctx) {
    throw new Error('Unauthorized');
  }

  return ctx;
}

async function listOfficeUsers(): Promise<string[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('persons')
    .select('person_id')
    .in('system_role', ['office', 'admin']);

  if (error) {
    throw new Error(`Failed to load office users: ${error.message}`);
  }

  return (data ?? []).map((row) => row.person_id as string);
}

async function loadSupplier(supplierId: string): Promise<SupplierRecord> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('suppliers')
    .select(
      'supplier_id, scope_type, scope_id, name, tax_id, contact_email, contact_phone, is_active, is_archived, deleted_at, created_at, updated_at',
    )
    .eq('supplier_id', supplierId)
    .single();

  if (error) {
    throw new Error(`Failed to load supplier: ${error.message}`);
  }

  return data as SupplierRecord;
}

async function loadDeliveryNote(deliveryNoteId: string): Promise<DeliveryNoteRecord> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('delivery_notes')
    .select(
      'delivery_note_id, restaurant_id, supplier_id, document_id, document_number, delivery_date, status, ocr_raw_json, uploaded_by, reviewed_by_employee, employee_reviewed_at, reviewed_by_office, office_reviewed_at, confirmed_at, rejection_reason, total_amount, tax_amount, created_at, updated_at',
    )
    .eq('delivery_note_id', deliveryNoteId)
    .single();

  if (error) {
    throw new Error(`Failed to load delivery note: ${error.message}`);
  }

  return data as DeliveryNoteRecord;
}

function assertCanManageSupplierScope(
  scopeType: CreateSupplierInput['scopeType'],
  scopeId: string,
  effectiveRestaurantId: string | null,
  systemRole: SystemRole,
): void {
  if (scopeType === 'chain') {
    if (systemRole === 'admin' || systemRole === 'office') {
      return;
    }

    throw new Error('FORBIDDEN: Solo oficina o admin pueden gestionar proveedores de cadena.');
  }

  if (
    (systemRole === 'manager' || systemRole === 'sub_manager') &&
    effectiveRestaurantId === scopeId
  ) {
    return;
  }

  if (systemRole === 'admin' || systemRole === 'office') {
    return;
  }

  throw new Error('FORBIDDEN: No puedes gestionar proveedores de este restaurante.');
}

export async function listSuppliers(
  params?: { restaurantId?: string; scopeType?: 'chain' | 'restaurant' },
): Promise<SupplierRecord[]> {
  const ctx = await getRequiredCurrentUserContext();
  const admin = createSupabaseAdminClient();
  let query = admin
    .from('suppliers')
    .select(
      'supplier_id, scope_type, scope_id, name, tax_id, contact_email, contact_phone, is_active, is_archived, deleted_at, created_at, updated_at',
    )
    .order('name', { ascending: true });

  if (params?.scopeType) {
    query = query.eq('scope_type', params.scopeType);
  }

  if (params?.restaurantId) {
    assertRestaurantAccess(ctx.requestContext, params.restaurantId);
    query = query.or(`scope_id.eq.${params.restaurantId},scope_type.eq.chain`);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to list suppliers: ${error.message}`);
  }

  return (data ?? []) as SupplierRecord[];
}

export async function createSupplier(input: CreateSupplierInput): Promise<SupplierRecord> {
  const ctx = await getRequiredCurrentUserContext();
  assertCanManageSupplierScope(
    input.scopeType,
    input.scopeId,
    ctx.requestContext.effectiveRestaurantId,
    ctx.requestContext.systemRole,
  );

  const admin = createSupabaseAdminClient();
  const payload = {
    contact_email: input.contactEmail ?? null,
    contact_phone: input.contactPhone ?? null,
    name: input.name,
    scope_id: input.scopeId,
    scope_type: input.scopeType,
    tax_id: input.taxId ?? null,
  };
  const { data, error } = await admin
    .from('suppliers')
    .insert(payload)
    .select(
      'supplier_id, scope_type, scope_id, name, tax_id, contact_email, contact_phone, is_active, is_archived, deleted_at, created_at, updated_at',
    )
    .single();

  if (error) {
    throw new Error(`Failed to create supplier: ${error.message}`);
  }

  await writeAuditLog({
    action: AUDIT_ACTIONS.supplierCreated,
    entityId: data.supplier_id,
    entityType: 'supplier',
    newValue: payload,
    scopeId: input.scopeType === 'restaurant' ? input.scopeId : null,
    scopeType: input.scopeType === 'restaurant' ? 'restaurant' : 'chain',
    traceId: ctx.requestContext.traceId,
  });

  return data as SupplierRecord;
}

export async function listProducts(supplierId: string): Promise<ProductRecord[]> {
  const ctx = await getRequiredCurrentUserContext();
  const supplier = await loadSupplier(supplierId);
  if (supplier.scope_type === 'restaurant') {
    assertRestaurantAccess(ctx.requestContext, supplier.scope_id);
  } else if (!isGlobalSystemRole(ctx.requestContext)) {
    throw new Error('FORBIDDEN: Solo office o admin pueden ver productos de cadena.');
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('products')
    .select(
      'product_id, supplier_id, name, description, unit, is_active, is_archived, deleted_at, created_at, updated_at',
    )
    .eq('supplier_id', supplierId)
    .order('name', { ascending: true });

  if (error) {
    throw new Error(`Failed to list products: ${error.message}`);
  }

  return (data ?? []) as ProductRecord[];
}

export async function createProduct(input: CreateProductInput): Promise<ProductRecord> {
  const ctx = await getRequiredCurrentUserContext();
  const supplier = await loadSupplier(input.supplierId);
  assertCanManageSupplierScope(
    supplier.scope_type,
    supplier.scope_id,
    ctx.requestContext.effectiveRestaurantId,
    ctx.requestContext.systemRole,
  );

  const admin = createSupabaseAdminClient();
  const payload = {
    description: input.description ?? null,
    name: input.name,
    supplier_id: input.supplierId,
    unit: input.unit ?? null,
  };
  const { data, error } = await admin
    .from('products')
    .insert(payload)
    .select(
      'product_id, supplier_id, name, description, unit, is_active, is_archived, deleted_at, created_at, updated_at',
    )
    .single();

  if (error) {
    throw new Error(`Failed to create product: ${error.message}`);
  }

  await writeAuditLog({
    action: AUDIT_ACTIONS.productCreated,
    entityId: data.product_id,
    entityType: 'product',
    newValue: payload,
    scopeId: supplier.scope_type === 'restaurant' ? supplier.scope_id : null,
    scopeType: supplier.scope_type === 'restaurant' ? 'restaurant' : 'chain',
    traceId: ctx.requestContext.traceId,
  });

  return data as ProductRecord;
}

export async function listDeliveryNotes(
  restaurantId: string,
): Promise<DeliveryNoteRecord[]> {
  const ctx = await getRequiredCurrentUserContext();
  assertRestaurantAccess(ctx.requestContext, restaurantId);

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('delivery_notes')
    .select(
      'delivery_note_id, restaurant_id, supplier_id, document_id, document_number, delivery_date, status, ocr_raw_json, uploaded_by, reviewed_by_employee, employee_reviewed_at, reviewed_by_office, office_reviewed_at, confirmed_at, rejection_reason, total_amount, tax_amount, created_at, updated_at',
    )
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to list delivery notes: ${error.message}`);
  }

  return (data ?? []) as DeliveryNoteRecord[];
}

export async function getDeliveryNoteLines(
  deliveryNoteId: string,
): Promise<DeliveryNoteLineRecord[]> {
  const ctx = await getRequiredCurrentUserContext();
  const deliveryNote = await loadDeliveryNote(deliveryNoteId);
  assertRestaurantAccess(ctx.requestContext, deliveryNote.restaurant_id);

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('delivery_note_lines')
    .select(
      'line_id, delivery_note_id, product_id, product_name_raw, quantity, unit, unit_price, tax_rate, tax_amount, line_total, is_new_product, created_at, updated_at',
    )
    .eq('delivery_note_id', deliveryNoteId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to list delivery note lines: ${error.message}`);
  }

  return (data ?? []) as DeliveryNoteLineRecord[];
}

export async function createDeliveryNote(
  input: CreateDeliveryNoteInput,
): Promise<DeliveryNoteRecord> {
  const ctx = await getRequiredCurrentUserContext();
  assertRestaurantAccess(ctx.requestContext, input.restaurantId);

  const admin = createSupabaseAdminClient();
  const notePayload = {
    delivery_date: input.deliveryDate ?? null,
    document_number: input.documentNumber ?? null,
    ocr_raw_json: input.ocrRawJson ?? null,
    restaurant_id: input.restaurantId,
    status: 'uploaded',
    supplier_id: input.supplierId ?? null,
    tax_amount: input.taxAmount ?? null,
    total_amount: input.totalAmount ?? null,
    uploaded_by: ctx.userId,
  };
  const { data: note, error: noteError } = await admin
    .from('delivery_notes')
    .insert(notePayload)
    .select(
      'delivery_note_id, restaurant_id, supplier_id, document_id, document_number, delivery_date, status, ocr_raw_json, uploaded_by, reviewed_by_employee, employee_reviewed_at, reviewed_by_office, office_reviewed_at, confirmed_at, rejection_reason, total_amount, tax_amount, created_at, updated_at',
    )
    .single();

  if (noteError) {
    throw new Error(`Failed to create delivery note: ${noteError.message}`);
  }

  const linePayload = input.lines.map((line) => ({
    delivery_note_id: note.delivery_note_id,
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

  if (linePayload.length > 0) {
    const { error: linesError } = await admin.from('delivery_note_lines').insert(linePayload);
    if (linesError) {
      throw new Error(`Failed to create delivery note lines: ${linesError.message}`);
    }
  }

  const { data: document, error: documentError } = await admin
    .from('documents')
    .insert({
      created_by: ctx.userId,
      document_status: 'active',
      document_type: 'delivery_note',
      file_url: input.fileUrl,
      owner_id: note.delivery_note_id,
      owner_type: 'delivery_note',
      requires_reauth: false,
      visibility: 'management_visible',
    })
    .select('document_id')
    .single();

  if (documentError) {
    throw new Error(`Failed to create delivery note document: ${documentError.message}`);
  }

  const { data, error } = await admin
    .from('delivery_notes')
    .update({ document_id: document.document_id })
    .eq('delivery_note_id', note.delivery_note_id)
    .select(
      'delivery_note_id, restaurant_id, supplier_id, document_id, document_number, delivery_date, status, ocr_raw_json, uploaded_by, reviewed_by_employee, employee_reviewed_at, reviewed_by_office, office_reviewed_at, confirmed_at, rejection_reason, total_amount, tax_amount, created_at, updated_at',
    )
    .single();

  if (error) {
    throw new Error(`Failed to attach delivery note document: ${error.message}`);
  }

  await writeAuditLog({
    action: AUDIT_ACTIONS.deliveryNoteUploaded,
    entityId: data.delivery_note_id,
    entityType: 'delivery_note',
    newValue: {
      ...notePayload,
      ocr_raw_json: null,
    },
    scopeId: input.restaurantId,
    scopeType: 'restaurant',
    traceId: ctx.requestContext.traceId,
  });

  const officeUsers = await listOfficeUsers();
  if (officeUsers.length > 0) {
    await notifyPeople(
      officeUsers.map((recipientPersonId) => ({
        body: 'Se ha subido un nuevo albaran pendiente de revision.',
        entityId: data.delivery_note_id as string,
        entityType: 'delivery_note',
        notificationType: 'delivery_note_submitted',
        recipientPersonId,
        scopeId: input.restaurantId,
        scopeType: 'restaurant',
        sendPush: true,
        title: 'Nuevo albaran',
        traceId: ctx.requestContext.traceId,
      })),
    );
  }

  return data as DeliveryNoteRecord;
}

export async function reviewDeliveryNoteByEmployee(
  deliveryNoteId: string,
): Promise<DeliveryNoteRecord> {
  const ctx = await getRequiredCurrentUserContext();
  const current = await loadDeliveryNote(deliveryNoteId);
  assertRestaurantAccess(ctx.requestContext, current.restaurant_id);

  const patch = {
    employee_reviewed_at: new Date().toISOString(),
    reviewed_by_employee: ctx.userId,
    status: 'employee_reviewed',
  };
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('delivery_notes')
    .update(patch)
    .eq('delivery_note_id', deliveryNoteId)
    .select(
      'delivery_note_id, restaurant_id, supplier_id, document_id, document_number, delivery_date, status, ocr_raw_json, uploaded_by, reviewed_by_employee, employee_reviewed_at, reviewed_by_office, office_reviewed_at, confirmed_at, rejection_reason, total_amount, tax_amount, created_at, updated_at',
    )
    .single();

  if (error) {
    throw new Error(`Failed to review delivery note by employee: ${error.message}`);
  }

  await writeAuditLog({
    action: AUDIT_ACTIONS.deliveryNoteEmployeeReviewed,
    entityId: deliveryNoteId,
    entityType: 'delivery_note',
    newValue: patch,
    scopeId: current.restaurant_id,
    scopeType: 'restaurant',
    traceId: ctx.requestContext.traceId,
  });

  return data as DeliveryNoteRecord;
}

export async function confirmDeliveryNoteByOffice(
  deliveryNoteId: string,
): Promise<DeliveryNoteRecord> {
  const ctx = await getRequiredCurrentUserContext();
  if (!isGlobalSystemRole(ctx.requestContext)) {
    throw new Error('FORBIDDEN: Solo office o admin pueden confirmar albaranes.');
  }

  const current = await loadDeliveryNote(deliveryNoteId);
  const patch = {
    confirmed_at: new Date().toISOString(),
    office_reviewed_at: new Date().toISOString(),
    reviewed_by_office: ctx.userId,
    status: 'confirmed',
  };
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('delivery_notes')
    .update(patch)
    .eq('delivery_note_id', deliveryNoteId)
    .select(
      'delivery_note_id, restaurant_id, supplier_id, document_id, document_number, delivery_date, status, ocr_raw_json, uploaded_by, reviewed_by_employee, employee_reviewed_at, reviewed_by_office, office_reviewed_at, confirmed_at, rejection_reason, total_amount, tax_amount, created_at, updated_at',
    )
    .single();

  if (error) {
    throw new Error(`Failed to confirm delivery note: ${error.message}`);
  }

  await writeAuditLog({
    action: AUDIT_ACTIONS.deliveryNoteOfficeConfirmed,
    entityId: deliveryNoteId,
    entityType: 'delivery_note',
    newValue: patch,
    scopeId: current.restaurant_id,
    scopeType: 'restaurant',
    traceId: ctx.requestContext.traceId,
  });

  await notifyPerson({
    body: 'Tu albaran ha sido confirmado por oficina.',
    entityId: deliveryNoteId,
    entityType: 'delivery_note',
    notificationType: 'delivery_note_confirmed',
    recipientPersonId: current.uploaded_by,
    scopeId: current.restaurant_id,
    scopeType: 'restaurant',
    title: 'Albaran confirmado',
    traceId: ctx.requestContext.traceId,
  });

  return data as DeliveryNoteRecord;
}

export async function rejectDeliveryNoteByOffice(
  deliveryNoteId: string,
  rejectionReason: string,
): Promise<DeliveryNoteRecord> {
  const ctx = await getRequiredCurrentUserContext();
  if (!isGlobalSystemRole(ctx.requestContext)) {
    throw new Error('FORBIDDEN: Solo office o admin pueden rechazar albaranes.');
  }

  const current = await loadDeliveryNote(deliveryNoteId);
  const patch = {
    office_reviewed_at: new Date().toISOString(),
    rejection_reason: rejectionReason,
    reviewed_by_office: ctx.userId,
    status: 'rejected',
  };
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('delivery_notes')
    .update(patch)
    .eq('delivery_note_id', deliveryNoteId)
    .select(
      'delivery_note_id, restaurant_id, supplier_id, document_id, document_number, delivery_date, status, ocr_raw_json, uploaded_by, reviewed_by_employee, employee_reviewed_at, reviewed_by_office, office_reviewed_at, confirmed_at, rejection_reason, total_amount, tax_amount, created_at, updated_at',
    )
    .single();

  if (error) {
    throw new Error(`Failed to reject delivery note: ${error.message}`);
  }

  await writeAuditLog({
    action: AUDIT_ACTIONS.deliveryNoteOfficeRejected,
    entityId: deliveryNoteId,
    entityType: 'delivery_note',
    newValue: patch,
    scopeId: current.restaurant_id,
    scopeType: 'restaurant',
    traceId: ctx.requestContext.traceId,
  });

  await notifyPerson({
    body: 'Tu albaran ha sido rechazado por oficina.',
    entityId: deliveryNoteId,
    entityType: 'delivery_note',
    notificationType: 'delivery_note_rejected',
    recipientPersonId: current.uploaded_by,
    scopeId: current.restaurant_id,
    scopeType: 'restaurant',
    sendPush: true,
    title: 'Albaran rechazado',
    traceId: ctx.requestContext.traceId,
  });

  return data as DeliveryNoteRecord;
}
