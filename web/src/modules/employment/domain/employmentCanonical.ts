import type {
  CanonicalScopeType,
  CanonicalSystemRole,
} from '@/modules/authz/domain/canonicalCatalog';

export type CanonicalRoleScopeAssignment = {
  authority_tier: 'primary' | 'secondary' | null;
  created_at: string;
  person_id: string;
  scope_id: string;
  scope_type: CanonicalScopeType;
  valid_from: string;
  valid_to: string | null;
};

/**
 * Contexto laboral mutable (canónico).
 * Person puede existir sin empleo activo.
 */
export type CanonicalEmploymentRelationship = {
  company_id: string;
  contract_type: string | null;
  employment_id: string;
  job_title: string | null;
  person_id: string;
  requires_schedule: boolean;
  system_role: Extract<CanonicalSystemRole, 'manager' | 'area_lead' | 'employee'>;
  valid_from: string;
  valid_to: string | null;
};
