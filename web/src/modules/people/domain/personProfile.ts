import type { SystemRole } from '@/shared/authz';

export type AccessStatus =
  | 'pending_activation'
  | 'active'
  | 'suspended'
  | 'archived'
  | 'blocked';


export type PersonProfile = {
  access_status: AccessStatus;
  avatar_path: string | null;
  id: string;
  employee_code: number;
  full_name: string;
  is_archived?: boolean;

  restaurant_id: string | null;
  system_role: SystemRole;
  zone_id: string | null;
  chain_id?: string | null;
};
