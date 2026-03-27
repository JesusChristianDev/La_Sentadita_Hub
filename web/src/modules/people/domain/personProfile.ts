import type { SystemRole } from '@/modules/authz';

/**
 * @deprecated Read model/projection for UI compatibility only.
 * Source of truth must live in canonical Person + EmploymentRelationship + RoleScopeAssignment.
 */
export type AppRole =
  | 'employee'
  | 'manager'
  | 'sub_manager'
  | 'area_lead'
  | 'office'
  | 'admin'
  | 'chain_owner';

/**
 * @deprecated Projection/view for compatibility. Do not use as canonical domain entity.
 */
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
  // v6
  chain_id?: string | null;
  onboarding_status?: 'draft' | 'pending_activation' | 'active' | 'suspended';
};
