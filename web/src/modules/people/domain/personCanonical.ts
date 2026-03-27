import type { CanonicalSystemRole } from '@/modules/authz/domain/canonicalCatalog';

/**
 * Estado canónico de acceso funcional.
 * No reemplazar por flags booleanos sueltos.
 */
export type AccessStatus =
  | 'pending_activation'
  | 'active'
  | 'suspended'
  | 'archived'
  | 'blocked';

/**
 * Entidad canónica de persona (source of truth de identidad + acceso + rol).
 */
export type CanonicalPerson = {
  access_status: AccessStatus;
  avatar_url: string | null;
  chain_id: string | null;
  email: string | null;
  first_name: string;
  identity_document: string | null;
  last_name: string;
  person_id: string;
  phone: string | null;
  system_role: CanonicalSystemRole;
};
