import type { SystemRole } from '@/modules/authz';

export type AppRole = 'employee' | 'manager' | 'sub_manager' | 'area_lead' | 'office' | 'admin' | 'chain_owner';

export type PersonProfile = {
  avatar_path: string | null;
  id: string;
  employee_code: number;
  full_name: string;
  is_archived?: boolean;
  role: AppRole;
  is_active: boolean;
  restaurant_id: string | null;
  must_change_password: boolean;
  system_role?: SystemRole;
  zone_id: string | null;
};
