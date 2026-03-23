export type DocumentType =
  | 'employment_contract'
  | 'contract_addendum'
  | 'payroll'
  | 'identity_document'
  | 'medical_certificate'
  | 'absence_justification'
  | 'policy_document'
  | 'internal_report'
  | 'delivery_note';

export type DocumentOwnerType =
  | 'person'
  | 'employment_relationship'
  | 'procedure'
  | 'restaurant'
  | 'delivery_note';

export type DocumentVisibility =
  | 'employee_visible'
  | 'management_visible'
  | 'restricted_management'
  | 'administrative_only';

export type DocumentStatus = 'active' | 'superseded' | 'archived';

export type DocumentRecord = {
  created_at: string;
  created_by: string;
  document_id: string;
  document_status: DocumentStatus;
  document_type: DocumentType;
  file_url: string;
  owner_id: string;
  owner_type: DocumentOwnerType;
  requires_reauth: boolean;
  updated_at: string;
  version: number;
  visibility: DocumentVisibility;
};

export type CreateDocumentInput = {
  documentType: DocumentType;
  fileUrl: string;
  ownerId: string;
  ownerType: DocumentOwnerType;
  requiresReauth?: boolean;
  visibility: DocumentVisibility;
};
