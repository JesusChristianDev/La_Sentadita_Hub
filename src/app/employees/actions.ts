'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { type AppRole, getCurrentUserContext } from '@/modules/auth_users';
import { createEmployee } from '@/modules/employees';
import { getRestaurantStatus } from '@/modules/restaurants';
import {
  type EmployeeErrorCode,
  employeesPathWithError,
  employeesPathWithSuccess,
} from '@/shared/feedbackMessages';
import { createSupabaseAdminClient } from '@/shared/supabase/admin';

function canCreate(role: AppRole): boolean {
  return role === 'admin' || role === 'office';
}

function isAdminOrOffice(role: AppRole): boolean {
  return role === 'admin' || role === 'office';
}

function isValidEmail(value: string): boolean {
  // simple y suficiente para backend (evita basura)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isStrongPassword(value: string): boolean {
  // mínimo razonable (puedes subirlo más tarde)
  return value.length >= 8;
}

function parseRole(value: string): 'employee' | 'manager' | 'sub_manager' | null {
  if (value === 'employee' || value === 'manager' || value === 'sub_manager')
    return value;
  return null;
}

const ROLE_SLOT_ERROR_BY_ROLE: Record<'manager' | 'sub_manager', EmployeeErrorCode> = {
  manager: 'manager_exists',
  sub_manager: 'sub_manager_exists',
};

async function getEffectiveRestaurantId(
  role: AppRole,
  profileRestaurantId: string | null,
) {
  const store = await cookies();
  const active = store.get('active_restaurant_id')?.value ?? null;

  if (isAdminOrOffice(role)) return active ?? profileRestaurantId;
  return profileRestaurantId;
}

async function assertRoleSlotAvailable(
  restaurantId: string,
  role: 'manager' | 'sub_manager',
): Promise<void> {
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .from('profiles')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .eq('role', role)
    .eq('is_active', true)
    .is('deleted_at', null)
    .limit(1);

  if (error) {
    throw new Error(`Failed to check role slot: ${error.message}`);
  }

  if ((data ?? []).length > 0) {
    redirect(employeesPathWithError(ROLE_SLOT_ERROR_BY_ROLE[role]));
  }
}

export async function createEmployeeAction(formData: FormData) {
  const ctx = await getCurrentUserContext();
  if (!ctx) redirect('/login');

  if (!canCreate(ctx.profile.role)) redirect('/employees');

  const email = String(formData.get('email') ?? '').trim();
  const fullName = String(formData.get('fullName') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const restaurantId = String(formData.get('restaurantId') ?? '').trim();
  const roleRaw = String(formData.get('role') ?? '');
  const role = parseRole(roleRaw);

  if (!email || !fullName || !password || !restaurantId) {
    redirect(employeesPathWithError('missing'));
  }

  if (!isValidEmail(email)) {
    redirect(employeesPathWithError('invalid_email'));
  }

  if (!isStrongPassword(password)) {
    redirect(employeesPathWithError('weak_password'));
  }

  if (!role) {
    redirect(employeesPathWithError('invalid_role'));
  }

  // Anti-tamper: el restaurante del form debe coincidir con el restaurante "efectivo" del server
  const effectiveRestaurantId = await getEffectiveRestaurantId(
    ctx.profile.role,
    ctx.profile.restaurant_id,
  );

  if (!effectiveRestaurantId) {
    redirect(employeesPathWithError('no_effective_restaurant'));
  }

  if (restaurantId !== effectiveRestaurantId) {
    redirect(employeesPathWithError('restaurant_mismatch'));
  }

  // Validar que el restaurante existe y está activo
  const status = await getRestaurantStatus(restaurantId);
  if (!status || !status.is_active) {
    redirect(employeesPathWithError('restaurant_invalid'));
  }

  // Slots por restaurante: máximo 1 manager y 1 sub_manager activos
  if (role === 'manager' || role === 'sub_manager') {
    await assertRoleSlotAvailable(restaurantId, role);
  }

  try {
    await createEmployee({
      email,
      fullName,
      password,
      restaurantId,
      role,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    if (msg === 'sub_manager_exists') {
      redirect(employeesPathWithError('sub_manager_exists'));
    }
    if (msg === 'manager_exists') {
      redirect(employeesPathWithError('manager_exists'));
    }

    throw err; // lo demás sí es bug real
  }

  redirect(employeesPathWithSuccess('created'));
}
