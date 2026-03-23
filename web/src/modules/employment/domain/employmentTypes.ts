import type { SystemRole } from '@/modules/authz';
import type { AppRole } from '@/modules/people';

export type EditableEmployeeRole = Extract<AppRole, 'employee' | 'manager' | 'sub_manager' | 'area_lead'>;
export type EditableEmploymentSystemRole = Extract<
  SystemRole,
  'employee' | 'area_lead' | 'manager' | 'sub_manager'
>;
export type EmploymentSystemRole = Extract<
  SystemRole,
  'employee' | 'manager' | 'sub_manager' | 'area_lead'
>;
export type EmploymentStatusFilter = 'active' | 'inactive' | 'all';

export type RoleScopeAssignment = {
  scopeId: string | null;
  scopeType: 'restaurant' | 'zone';
};

export type EmploymentRelationship = {
  id: string;
  is_active: boolean;
  restaurant_id: string | null;
  role_scope_assignments: RoleScopeAssignment[];
  system_role: EmploymentSystemRole;
  zone_id: string | null;
};

export type EmploymentListItem = {
  avatar_path: string | null;
  employee_code: number;
  full_name: string;
  id: string;
  is_active?: boolean;
  restaurant_id: string | null;
  system_role: EmploymentSystemRole;
  zone_id: string | null;
};

// deriveEmploymentSystemRole removed: area_lead is now a first-class SystemRole.
