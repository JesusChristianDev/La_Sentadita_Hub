import type { AppRole } from './appRole';

export type Profile = {
  avatar_path: string | null;
  id: string;
  employee_code: number;
  full_name: string;
  role: AppRole;
  is_active: boolean;
  restaurant_id: string | null;
  must_change_password: boolean;
};
