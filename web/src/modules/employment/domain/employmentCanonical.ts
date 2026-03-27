import type {
  CanonicalScopeType,
  CanonicalSystemRole,
} from '@/modules/authz/domain/canonicalCatalog';

export type CanonicalRoleScopeAssignment = {
  active: boolean;
  assigned_at: string | null;
  person_id: string;
  scope_id: string | null;
  scope_type: CanonicalScopeType;
};

/**
 * Contexto laboral mutable (canónico).
 * Person puede existir sin empleo activo.
 */
export type CanonicalEmploymentRelationship = {
  active_principal: boolean;
  company_id: string | null;
  person_id: string;
  restaurant_id: string | null;
  started_at: string | null;
  system_role: Extract<CanonicalSystemRole, 'manager' | 'area_lead' | 'employee'>;
  terminated_at: string | null;
};
