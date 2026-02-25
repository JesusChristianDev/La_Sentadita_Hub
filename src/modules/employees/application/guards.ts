import { redirect } from 'next/navigation';

import type { AppRole } from '@/modules/auth_users';
import {
  employeeDetailPathWithError,
  type EmployeeErrorCode,
  employeesPathWithError,
} from '@/shared/feedbackMessages';
import { createSupabaseAdminClient } from '@/shared/supabase/admin';

import type { ZoneKey } from '../../area_leads/domain/zone';

// --------------- Role checks ---------------

export type EditableRole = 'employee' | 'manager' | 'sub_manager';

export function canCreate(role: AppRole): boolean {
  return role === 'admin' || role === 'office';
}

export function canManageUsers(role: AppRole): boolean {
  return (
    role === 'admin' ||
    role === 'office' ||
    role === 'manager' ||
    role === 'sub_manager'
  );
}

export function isAdminOrOffice(role: AppRole): boolean {
  return role === 'admin' || role === 'office';
}

// --------------- Parsing helpers ---------------

export function parseRole(value: string): EditableRole | null {
  if (value === 'employee' || value === 'manager' || value === 'sub_manager')
    return value;
  return null;
}

export function parseZone(value: string): ZoneKey | null {
  if (value === 'kitchen' || value === 'floor' || value === 'bar') return value;
  return null;
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isStrongPassword(value: string): boolean {
  return value.length >= 8;
}

// --------------- Authorization guards ---------------

export async function loadTarget(
  userId: string,
): Promise<{ role: string; restaurant_id: string | null }> {
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .from('profiles')
    .select('role, restaurant_id')
    .eq('id', userId)
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to load target profile: ${error?.message ?? 'unknown error'}`,
    );
  }

  return data;
}

export async function assertCanManageTarget(
  actor: { role: AppRole; restaurant_id: string | null },
  userId: string,
): Promise<{ role: string; restaurant_id: string | null }> {
  const target = await loadTarget(userId);

  // Nunca tocar globales desde Employees
  if (target.role === 'admin' || target.role === 'office') {
    redirect(employeesPathWithError('global_user'));
  }

  // Solo admin/office pueden editar/gestionar managers
  if (target.role === 'manager' && !isAdminOrOffice(actor.role)) {
    redirect(employeesPathWithError('manager_protected'));
  }

  // Manager/Subgerente: solo su restaurante
  if (
    (actor.role === 'manager' || actor.role === 'sub_manager') &&
    target.restaurant_id !== actor.restaurant_id
  ) {
    redirect(employeesPathWithError('restaurant_mismatch'));
  }

  return target;
}

// --------------- Slot validation ---------------

const ROLE_SLOT_ERROR_BY_ROLE: Record<
  'manager' | 'sub_manager',
  EmployeeErrorCode
> = {
  manager: 'manager_exists',
  sub_manager: 'sub_manager_exists',
};

export async function assertRoleSlotAvailable(
  restaurantId: string,
  role: 'manager' | 'sub_manager',
  excludingUserId?: string,
): Promise<void> {
  const admin = createSupabaseAdminClient();

  let query = admin
    .from('profiles')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .eq('role', role)
    .eq('is_active', true)
    .is('deleted_at', null)
    .limit(1);

  if (excludingUserId) {
    query = query.neq('id', excludingUserId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to check role slot: ${error.message}`);
  }

  if ((data ?? []).length > 0) {
    if (excludingUserId) {
      redirect(
        employeeDetailPathWithError(
          excludingUserId,
          ROLE_SLOT_ERROR_BY_ROLE[role],
        ),
      );
    }
    redirect(employeesPathWithError(ROLE_SLOT_ERROR_BY_ROLE[role]));
  }
}

export async function hasActiveAreaLead(userId: string): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('area_leads')
    .select('id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .is('revoked_at', null)
    .limit(1);

  if (error) {
    throw new Error(`Failed to check active area leads: ${error.message}`);
  }

  return (data ?? []).length > 0;
}

export function handleUniqueConstraint(err: unknown, userId: string): void {
  const msg = err instanceof Error ? err.message : String(err);

  if (msg.includes('ux_profiles_one_manager_per_restaurant')) {
    redirect(employeeDetailPathWithError(userId, 'manager_exists'));
  }

  if (msg.includes('ux_profiles_one_sub_manager_per_restaurant')) {
    redirect(employeeDetailPathWithError(userId, 'sub_manager_exists'));
  }
}
