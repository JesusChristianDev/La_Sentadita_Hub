import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { AUDIT_ACTIONS, writeAuditLog } from '@/modules/audit';
import { getCurrentUserContext } from '@/modules/auth_users';
import { notifyPerson } from '@/modules/notifications';
import { assertRestaurantManagement, isGlobalSystemRole } from '@/shared/authz';
import { loadPersonProfileById } from '@/shared/db/persons';

import type {
  CreateDocumentInput,
  DocumentRecord,
  DocumentVisibility,
} from '../domain/documentTypes';

type DocumentOwnerMetadata = {
  ownerPersonId: string | null;
  restaurantId: string | null;
};

async function getRequiredCurrentUserContext() {
  const ctx = await getCurrentUserContext();
  if (!ctx) {
    throw new Error('Unauthorized');
  }

  return ctx;
}

async function resolvePersonRestaurantId(personId: string): Promise<string | null> {
  const profile = await loadPersonProfileById(personId);
  return profile.restaurant_id ?? null;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function isCurrentTemporalRow(
  row: { valid_from: string; valid_to: string | null },
  today = todayIsoDate(),
): boolean {
  return row.valid_from <= today && (row.valid_to === null || row.valid_to >= today);
}

function sortTemporalDesc<T extends { created_at?: string | null; valid_from: string }>(
  rows: T[],
): T[] {
  return [...rows].sort(
    (left, right) =>
      right.valid_from.localeCompare(left.valid_from) ||
      (right.created_at ?? '').localeCompare(left.created_at ?? ''),
  );
}

async function resolveEmploymentRestaurantId(employmentId: string): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  const today = todayIsoDate();
  const { data, error } = await admin
    .from('employment_restaurant_assignments')
    .select('restaurant_id, valid_from, valid_to, created_at')
    .eq('employment_id', employmentId)
    .order('valid_from', { ascending: false });

  if (error) {
    throw new Error(`Failed to resolve employment restaurant: ${error.message}`);
  }

  const rows = (data ?? []) as Array<{
    created_at: string;
    restaurant_id: string;
    valid_from: string;
    valid_to: string | null;
  }>;
  const current =
    rows.find((row) => isCurrentTemporalRow(row, today)) ??
    sortTemporalDesc(rows)[0] ??
    null;

  return current?.restaurant_id ?? null;
}

async function resolveDocumentOwnerMetadata(
  ownerType: CreateDocumentInput['ownerType'],
  ownerId: string,
): Promise<DocumentOwnerMetadata> {
  const admin = createSupabaseAdminClient();

  if (ownerType === 'person') {
    return {
      ownerPersonId: ownerId,
      restaurantId: await resolvePersonRestaurantId(ownerId),
    };
  }

  if (ownerType === 'employment_relationship') {
    const { data, error } = await admin
      .from('employment_relationships')
      .select('person_id')
      .eq('employment_id', ownerId)
      .single();

    if (error) {
      throw new Error(`Failed to resolve employment document owner: ${error.message}`);
    }

    return {
      ownerPersonId: data.person_id as string,
      restaurantId: await resolveEmploymentRestaurantId(ownerId),
    };
  }

  if (ownerType === 'request') {
    const { data, error } = await admin
      .from('requests')
      .select('employment_id')
      .eq('request_id', ownerId)
      .single();

    if (error) {
      throw new Error(`Failed to resolve request document owner: ${error.message}`);
    }

    return resolveDocumentOwnerMetadata('employment_relationship', data.employment_id as string);
  }

  if (ownerType === 'restaurant') {
    return {
      ownerPersonId: null,
      restaurantId: ownerId,
    };
  }

  const { data, error } = await admin
    .from('delivery_notes')
    .select('restaurant_id, uploaded_by')
    .eq('delivery_note_id', ownerId)
    .single();

  if (error) {
    throw new Error(`Failed to resolve delivery note owner: ${error.message}`);
  }

  return {
    ownerPersonId: data.uploaded_by as string,
    restaurantId: data.restaurant_id as string,
  };
}

function canSelfAccessDocumentVisibility(visibility: DocumentVisibility): boolean {
  return visibility !== 'administrative_only';
}

async function assertCanAccessDocumentRecord(
  document: DocumentRecord,
): Promise<DocumentOwnerMetadata> {
  const ctx = await getRequiredCurrentUserContext();
  const metadata = await resolveDocumentOwnerMetadata(document.owner_type, document.owner_id);

  if (isGlobalSystemRole(ctx.requestContext)) {
    return metadata;
  }

  if (
    metadata.ownerPersonId === ctx.userId &&
    canSelfAccessDocumentVisibility(document.visibility)
  ) {
    return metadata;
  }

  if (metadata.restaurantId) {
    assertRestaurantManagement(ctx.requestContext, metadata.restaurantId);
    return metadata;
  }

  throw new Error('FORBIDDEN: No puedes acceder a este documento.');
}

async function loadDocument(documentId: string): Promise<DocumentRecord> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('documents')
    .select(
      'document_id, document_type, owner_type, owner_id, visibility, document_status, file_url, version, requires_reauth, created_by, created_at, updated_at',
    )
    .eq('document_id', documentId)
    .single();

  if (error) {
    throw new Error(`Failed to load document: ${error.message}`);
  }

  return data as DocumentRecord;
}

export async function listAccessibleDocuments(): Promise<DocumentRecord[]> {
  const ctx = await getRequiredCurrentUserContext();
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('documents')
    .select(
      'document_id, document_type, owner_type, owner_id, visibility, document_status, file_url, version, requires_reauth, created_by, created_at, updated_at',
    )
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(`Failed to list documents: ${error.message}`);
  }

  const documents = (data ?? []) as DocumentRecord[];
  const visibleDocuments: DocumentRecord[] = [];

  for (const document of documents) {
    try {
      const metadata = await resolveDocumentOwnerMetadata(document.owner_type, document.owner_id);

      if (isGlobalSystemRole(ctx.requestContext)) {
        visibleDocuments.push(document);
        continue;
      }

      if (
        metadata.ownerPersonId === ctx.userId &&
        canSelfAccessDocumentVisibility(document.visibility)
      ) {
        visibleDocuments.push(document);
        continue;
      }

      if (
        metadata.restaurantId &&
        (ctx.requestContext.systemRole === 'manager' ||
          ctx.requestContext.systemRole === 'office') &&
        ctx.requestContext.effectiveRestaurantId === metadata.restaurantId
      ) {
        visibleDocuments.push(document);
      }
    } catch {
      continue;
    }
  }

  return visibleDocuments;
}

export async function getDocument(documentId: string): Promise<DocumentRecord> {
  const ctx = await getRequiredCurrentUserContext();
  const document = await loadDocument(documentId);
  const metadata = await assertCanAccessDocumentRecord(document);

  await writeAuditLog({
    action: AUDIT_ACTIONS.documentViewed,
    entityId: documentId,
    entityType: 'document',
    scopeId: metadata.restaurantId,
    scopeType: metadata.restaurantId ? 'restaurant' : null,
    traceId: ctx.requestContext.traceId,
  });

  return document;
}

export async function createDocument(input: CreateDocumentInput): Promise<DocumentRecord> {
  const ctx = await getRequiredCurrentUserContext();
  const metadata = await resolveDocumentOwnerMetadata(input.ownerType, input.ownerId);

  const isSelfOwned = metadata.ownerPersonId === ctx.userId;
  if (!isSelfOwned && metadata.restaurantId) {
    assertRestaurantManagement(ctx.requestContext, metadata.restaurantId);
  }

  const admin = createSupabaseAdminClient();
  const payload = {
    created_by: ctx.userId,
    document_status: 'active',
    document_type: input.documentType,
    file_url: input.fileUrl,
    owner_id: input.ownerId,
    owner_type: input.ownerType,
    requires_reauth: input.requiresReauth ?? false,
    version: 1,
    visibility: input.visibility,
  };
  const { data, error } = await admin
    .from('documents')
    .insert(payload)
    .select(
      'document_id, document_type, owner_type, owner_id, visibility, document_status, file_url, version, requires_reauth, created_by, created_at, updated_at',
    )
    .single();

  if (error) {
    throw new Error(`Failed to create document: ${error.message}`);
  }

  await writeAuditLog({
    action: AUDIT_ACTIONS.documentUploaded,
    entityId: data.document_id,
    entityType: 'document',
    newValue: payload,
    scopeId: metadata.restaurantId,
    scopeType: metadata.restaurantId ? 'restaurant' : null,
    traceId: ctx.requestContext.traceId,
  });

  if (metadata.ownerPersonId && input.visibility === 'employee_visible') {
    await notifyPerson({
      body: 'Tienes un nuevo documento disponible.',
      entityId: data.document_id as string,
      entityType: 'document',
      notificationType: 'document_uploaded',
      recipientPersonId: metadata.ownerPersonId,
      scopeId: metadata.restaurantId,
      scopeType: metadata.restaurantId ? 'restaurant' : null,
      title: 'Nuevo documento',
      traceId: ctx.requestContext.traceId,
    });
  }

  return data as DocumentRecord;
}

export async function archiveDocument(documentId: string): Promise<DocumentRecord> {
  const ctx = await getRequiredCurrentUserContext();
  const current = await loadDocument(documentId);
  const metadata = await resolveDocumentOwnerMetadata(current.owner_type, current.owner_id);

  if (metadata.restaurantId) {
    assertRestaurantManagement(ctx.requestContext, metadata.restaurantId);
  } else if (!isGlobalSystemRole(ctx.requestContext)) {
    throw new Error('FORBIDDEN: No puedes archivar este documento.');
  }

  const patch = { document_status: 'archived' };
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('documents')
    .update(patch)
    .eq('document_id', documentId)
    .select(
      'document_id, document_type, owner_type, owner_id, visibility, document_status, file_url, version, requires_reauth, created_by, created_at, updated_at',
    )
    .single();

  if (error) {
    throw new Error(`Failed to archive document: ${error.message}`);
  }

  await writeAuditLog({
    action: AUDIT_ACTIONS.documentArchived,
    entityId: documentId,
    entityType: 'document',
    newValue: patch,
    previousValue: { document_status: current.document_status },
    scopeId: metadata.restaurantId,
    scopeType: metadata.restaurantId ? 'restaurant' : null,
    traceId: ctx.requestContext.traceId,
  });

  return data as DocumentRecord;
}

export async function supersedeDocument(
  documentId: string,
  replacement: CreateDocumentInput,
): Promise<{ next: DocumentRecord; previous: DocumentRecord }> {
  const ctx = await getRequiredCurrentUserContext();
  const current = await loadDocument(documentId);
  const metadata = await resolveDocumentOwnerMetadata(current.owner_type, current.owner_id);

  if (metadata.restaurantId) {
    assertRestaurantManagement(ctx.requestContext, metadata.restaurantId);
  } else if (!isGlobalSystemRole(ctx.requestContext)) {
    throw new Error('FORBIDDEN: No puedes versionar este documento.');
  }

  const next = await createDocument(replacement);
  const admin = createSupabaseAdminClient();
  const { data: previous, error } = await admin
    .from('documents')
    .update({ document_status: 'superseded' })
    .eq('document_id', documentId)
    .select(
      'document_id, document_type, owner_type, owner_id, visibility, document_status, file_url, version, requires_reauth, created_by, created_at, updated_at',
    )
    .single();

  if (error) {
    throw new Error(`Failed to supersede document: ${error.message}`);
  }

  await writeAuditLog({
    action: AUDIT_ACTIONS.documentSuperseded,
    entityId: documentId,
    entityType: 'document',
    newValue: { document_status: 'superseded', replacement_document_id: next.document_id },
    previousValue: { document_status: current.document_status },
    scopeId: metadata.restaurantId,
    scopeType: metadata.restaurantId ? 'restaurant' : null,
    traceId: ctx.requestContext.traceId,
  });

  if (metadata.ownerPersonId) {
    await notifyPerson({
      body: 'Uno de tus documentos ha sido sustituido por una nueva version.',
      entityId: documentId,
      entityType: 'document',
      notificationType: 'document_superseded',
      recipientPersonId: metadata.ownerPersonId,
      scopeId: metadata.restaurantId,
      scopeType: metadata.restaurantId ? 'restaurant' : null,
      title: 'Documento actualizado',
      traceId: ctx.requestContext.traceId,
    });
  }

  return {
    next,
    previous: previous as DocumentRecord,
  };
}
