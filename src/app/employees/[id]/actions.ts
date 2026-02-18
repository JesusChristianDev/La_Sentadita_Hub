'use server';

import { redirect } from 'next/navigation';

import { assignAreaLead, revokeAreaLead, type ZoneKey } from '@/modules/area_leads';
import { type AppRole, getCurrentUserContext } from '@/modules/auth_users';
import { deleteEmployee, setEmployeeActive, updateEmployee } from '@/modules/employees';
import { getRestaurantStatus } from '@/modules/restaurants';
import {
  employeeDetailPathWithError,
  type EmployeeErrorCode,
  employeesPathWithError,
} from '@/shared/feedbackMessages';
import { createSupabaseAdminClient } from '@/shared/supabase/admin';

function canManageUsers(role: AppRole): boolean {
  return (
    role === 'admin' ||
    role === 'office' ||
    role === 'manager' ||
    role === 'sub_manager'
  );
}

function isAdminOrOffice(role: AppRole): boolean {
  return role === 'admin' || role === 'office';
}

type EditableRole = 'employee' | 'manager' | 'sub_manager';

function parseRole(value: string): EditableRole | null {
  if (value === 'employee' || value === 'manager' || value === 'sub_manager')
    return value;
  return null;
}

function parseZone(value: string): ZoneKey | null {
  if (value === 'kitchen' || value === 'floor' || value === 'bar') return value;
  return null;
}

async function loadTarget(
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

async function assertCanManageTarget(
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

async function assertRoleSlotAvailable(
  restaurantId: string,
  role: 'manager' | 'sub_manager',
  excludingUserId: string,
) {
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .from('profiles')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .eq('role', role)
    .eq('is_active', true)
    .is('deleted_at', null)
    .neq('id', excludingUserId)
    .limit(1);

  if (error) {
    throw new Error(`Failed to check role slot: ${error.message}`);
  }

  if ((data ?? []).length > 0) {
    const roleErrorCode: EmployeeErrorCode =
      role === 'manager' ? 'manager_exists' : 'sub_manager_exists';
    redirect(employeeDetailPathWithError(excludingUserId, roleErrorCode));
  }
}

async function hasActiveAreaLead(userId: string): Promise<boolean> {
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

function handleUniqueConstraint(err: unknown, userId: string): void {
  const msg = err instanceof Error ? err.message : String(err);

  if (msg.includes('ux_profiles_one_manager_per_restaurant')) {
    redirect(employeeDetailPathWithError(userId, 'manager_exists'));
  }

  if (msg.includes('ux_profiles_one_sub_manager_per_restaurant')) {
    redirect(employeeDetailPathWithError(userId, 'sub_manager_exists'));
  }
}

export async function updateEmployeeAction(userId: string, formData: FormData) {
  const ctx = await getCurrentUserContext();
  if (!ctx) redirect('/login');
  if (!canManageUsers(ctx.profile.role)) redirect('/employees');

  const target = await assertCanManageTarget(ctx.profile, userId);

  const fullName = String(formData.get('fullName') ?? '').trim();
  const restaurantId = String(formData.get('restaurantId') ?? '').trim();
  const roleRaw = String(formData.get('role') ?? '');
  const role = parseRole(roleRaw);

  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!fullName || !restaurantId || !role) {
    redirect(employeeDetailPathWithError(userId, 'missing'));
  }

  // Manager/Subgerente solo gestionan su restaurante
  if (
    (ctx.profile.role === 'manager' || ctx.profile.role === 'sub_manager') &&
    restaurantId !== ctx.profile.restaurant_id
  ) {
    redirect(employeesPathWithError('restaurant_mismatch'));
  }

  // Manager/Subgerente no pueden cambiar roles (solo admin/office definen roles especiales)
  if (
    (ctx.profile.role === 'manager' || ctx.profile.role === 'sub_manager') &&
    role !== target.role
  ) {
    redirect(employeeDetailPathWithError(userId, 'invalid_role'));
  }

  const status = await getRestaurantStatus(restaurantId);
  if (!status || !status.is_active) {
    redirect(employeeDetailPathWithError(userId, 'restaurant_invalid'));
  }

  // Slots por restaurante (solo 1 manager y 1 sub_manager activos)
  if (role === 'manager' || role === 'sub_manager') {
    if (await hasActiveAreaLead(userId)) {
      redirect(employeeDetailPathWithError(userId, 'area_lead_only_employee'));
    }
    await assertRoleSlotAvailable(restaurantId, role, userId);
  }

  try {
    await updateEmployee({
      userId,
      fullName,
      restaurantId,
      role,
      email: email ? email : undefined,
      password: password ? password : undefined,
    });
  } catch (err) {
    handleUniqueConstraint(err, userId);
    throw err;
  }

  redirect(`/employees/${userId}`);
}

export async function deactivateEmployeeAction(userId: string) {
  const ctx = await getCurrentUserContext();
  if (!ctx) redirect('/login');
  if (!canManageUsers(ctx.profile.role)) redirect('/employees');

  await assertCanManageTarget(ctx.profile, userId);

  await setEmployeeActive(userId, false);
  redirect(`/employees/${userId}`);
}

export async function reactivateEmployeeAction(userId: string) {
  const ctx = await getCurrentUserContext();
  if (!ctx) redirect('/login');
  if (!canManageUsers(ctx.profile.role)) redirect('/employees');

  await assertCanManageTarget(ctx.profile, userId);

  await setEmployeeActive(userId, true);
  redirect(`/employees/${userId}`);
}

export async function softDeleteEmployeeAction(userId: string) {
  const ctx = await getCurrentUserContext();
  if (!ctx) redirect('/login');
  if (!canManageUsers(ctx.profile.role)) redirect('/employees');

  await assertCanManageTarget(ctx.profile, userId);

  await deleteEmployee(userId, { soft: true });
  redirect('/employees');
}

export async function assignAreaLeadAction(userId: string, formData: FormData) {
  const ctx = await getCurrentUserContext();
  if (!ctx) redirect('/login');
  if (!canManageUsers(ctx.profile.role)) redirect('/employees');

  const target = await assertCanManageTarget(ctx.profile, userId);

  if (!target.restaurant_id) {
    redirect(employeeDetailPathWithError(userId, 'missing'));
  }

  const zone = parseZone(String(formData.get('zone') ?? ''));

  if (!zone) {
    redirect(employeeDetailPathWithError(userId, 'missing'));
  }

  if (target.role !== 'employee') {
    redirect(employeeDetailPathWithError(userId, 'area_lead_only_employee'));
  }

  try {
    await assignAreaLead({
      restaurantId: target.restaurant_id,
      zone,
      userId,
      assignedBy: ctx.profile.id,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'area_lead_zone_full') {
      redirect(employeeDetailPathWithError(userId, 'area_lead_zone_full'));
    }
    throw err;
  }

  redirect(`/employees/${userId}`);
}

export async function revokeAreaLeadAction(userId: string, leadId: string) {
  const ctx = await getCurrentUserContext();
  if (!ctx) redirect('/login');
  if (!canManageUsers(ctx.profile.role)) redirect('/employees');

  const target = await assertCanManageTarget(ctx.profile, userId);

  const admin = createSupabaseAdminClient();
  const { data: lead, error } = await admin
    .from('area_leads')
    .select('id, user_id, restaurant_id, is_active, revoked_at')
    .eq('id', leadId)
    .single();

  if (error || !lead) {
    redirect(`/employees/${userId}`);
  }

  if (
    lead.user_id !== userId ||
    lead.restaurant_id !== target.restaurant_id ||
    !lead.is_active ||
    lead.revoked_at
  ) {
    redirect(`/employees/${userId}`);
  }

  await revokeAreaLead(leadId);
  redirect(`/employees/${userId}`);
}
