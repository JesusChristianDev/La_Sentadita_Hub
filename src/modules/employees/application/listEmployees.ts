import { createSupabaseAdminClient } from '@/shared/supabase/admin';

import type { EmployeeListItem } from '../domain/employeeListItem';

export type EmployeeStatusFilter = 'active' | 'inactive' | 'all';

export async function listEmployees(
  restaurantId: string,
  status: EmployeeStatusFilter = 'active',
) {
  const supabase = createSupabaseAdminClient();

  let query = supabase
    .from('profiles')
    .select('id, employee_code, full_name, role, restaurant_id, avatar_path, is_active')
    .eq('restaurant_id', restaurantId)
    .order('employee_code', { ascending: true })
    .in('role', ['employee', 'manager', 'sub_manager']);

  if (status === 'active') query = query.eq('is_active', true);
  if (status === 'inactive') query = query.eq('is_active', false);

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list employees: ${error.message}`);
  }

  return (data ?? []) as EmployeeListItem[];
}
