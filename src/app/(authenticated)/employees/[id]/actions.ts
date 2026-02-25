'use server';

import { redirect } from 'next/navigation';

import { assignAreaLead, revokeAreaLead } from '@/modules/area_leads';
import { getCurrentUserContext } from '@/modules/auth_users';
import { deleteEmployee, setEmployeeActive, updateEmployee } from '@/modules/employees';
import {
  assertCanManageTarget,
  assertRoleSlotAvailable,
  canManageUsers,
  handleUniqueConstraint,
  hasActiveAreaLead,
  parseRole,
  parseZone,
} from '@/modules/employees/application/guards';
import { getRestaurantStatus } from '@/modules/restaurants';
import {
  employeeDetailPathWithError,
  employeesPathWithError,
} from '@/shared/feedbackMessages';
import { createSupabaseAdminClient } from '@/shared/supabase/admin';

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
