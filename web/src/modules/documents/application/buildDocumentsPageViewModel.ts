import 'server-only';

import { buildFrontendSessionView, type CurrentSession } from '@/modules/auth_users';

import type {
  DocumentOwnerType,
  DocumentRecord,
  DocumentType,
  DocumentVisibility,
} from '../domain/documentTypes';
import { listAccessibleDocuments } from './documentService';

type DocumentsSummary = {
  active: number;
  archived: number;
  superseded: number;
  total: number;
};

export type DocumentOwnerTarget = {
  description: string;
  ownerId: string;
  ownerType: DocumentOwnerType;
  value: string;
};

export type DocumentsPageViewModel = {
  activeScopeLabel: string;
  canArchiveDocument: boolean;
  canCreateDocument: boolean;
  canManageDocuments: boolean;
  canSupersedeDocument: boolean;
  createDefaults: {
    documentType: DocumentType;
    requiresReauth: boolean;
    visibility: DocumentVisibility;
  };
  documents: DocumentRecord[];
  mode: 'forbidden' | 'ready';
  ownerTargets: DocumentOwnerTarget[];
  summary: DocumentsSummary;
};

function resolveDefaultOwnerType(session: CurrentSession): DocumentOwnerType {
  return session.backendSession.effectiveRestaurantId ? 'restaurant' : 'person';
}

function resolveDefaultVisibility(ownerType: DocumentOwnerType): DocumentVisibility {
  return ownerType === 'person' ? 'employee_visible' : 'management_visible';
}

function buildSummary(documents: DocumentRecord[]): DocumentsSummary {
  return documents.reduce<DocumentsSummary>(
    (acc, document) => {
      acc.total += 1;
      if (document.document_status === 'active') acc.active += 1;
      if (document.document_status === 'archived') acc.archived += 1;
      if (document.document_status === 'superseded') acc.superseded += 1;
      return acc;
    },
    { active: 0, archived: 0, superseded: 0, total: 0 },
  );
}

function buildOwnerTargets(session: CurrentSession): DocumentOwnerTarget[] {
  const targets: DocumentOwnerTarget[] = [
    {
      description: 'Documento personal visible para ti.',
      ownerId: session.userId,
      ownerType: 'person',
      value: `person:${session.userId}`,
    },
  ];

  const currentEmploymentId = session.backendSession.currentEmployment?.employmentId ?? null;
  if (currentEmploymentId) {
    targets.push({
      description: 'Documento vinculado a tu empleo actual.',
      ownerId: currentEmploymentId,
      ownerType: 'employment_relationship',
      value: `employment_relationship:${currentEmploymentId}`,
    });
  }

  const effectiveRestaurantId = session.backendSession.effectiveRestaurantId;
  if (effectiveRestaurantId) {
    targets.push({
      description: 'Documento del restaurante en contexto.',
      ownerId: effectiveRestaurantId,
      ownerType: 'restaurant',
      value: `restaurant:${effectiveRestaurantId}`,
    });
  }

  return targets;
}

export async function buildDocumentsPageViewModel(
  session: CurrentSession,
): Promise<DocumentsPageViewModel> {
  const frontendSession = buildFrontendSessionView(session);

  if (!frontendSession.capabilities.documents.view) {
    return {
      activeScopeLabel: frontendSession.activeScope.label,
      canArchiveDocument: false,
      canCreateDocument: false,
      canManageDocuments: false,
      canSupersedeDocument: false,
      createDefaults: {
        documentType: 'policy_document',
        requiresReauth: false,
        visibility: 'employee_visible',
      },
      documents: [],
      mode: 'forbidden',
      ownerTargets: [],
      summary: { active: 0, archived: 0, superseded: 0, total: 0 },
    };
  }

  const documents = await listAccessibleDocuments();
  const ownerType = resolveDefaultOwnerType(session);
  const ownerTargets = buildOwnerTargets(session);

  return {
    activeScopeLabel: frontendSession.activeScope.label,
    canArchiveDocument:
      frontendSession.capabilities.documents.manage,
    canCreateDocument: frontendSession.capabilities.documents.create,
    canManageDocuments: frontendSession.capabilities.documents.manage,
    canSupersedeDocument: frontendSession.capabilities.documents.manage,
    createDefaults: {
      documentType: 'policy_document',
      requiresReauth: false,
      visibility: resolveDefaultVisibility(ownerType),
    },
    documents,
    mode: 'ready',
    ownerTargets,
    summary: buildSummary(documents),
  };
}
