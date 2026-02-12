import type { AppRole } from '@/modules/auth_users';

export type EmployeeListItem = {
  avatar_path: string | null;
  employee_code: number;
  full_name: string;
  id: string;
  restaurant_id: string | null;
  role: AppRole;
};
