'use server';

import { redirect } from 'next/navigation';

import { getCurrentUserContext } from '@/modules/auth_users';
import { deleteEmployee, setEmployeeActive, updateEmployee } from '@/modules/employees';
import { createEmployeeMutationService } from '@/modules/employees/application/employeeMutationService';
import {
  assertCanManageTarget,
  canManageUsers,
  getRoleSlotConflictCode,
} from '@/modules/employees/application/guards';
import { getRestaurantStatus } from '@/modules/restaurants';
import {
  employeeDetailPathWithError,
  employeesPathWithError,
} from '@/shared/feedbackMessages';

export async function updateEmployeeAction(userId: string, formData: FormData) {
  const ctx = await getCurrentUserContext();
  if (!ctx) redirect('/login');
  if (!canManageUsers(ctx.profile.role)) redirect('/employees');

  const target = await assertCanManageTarget(ctx.profile, userId);

  const fullName = String(formData.get('fullName') ?? '').trim();
  const restaurantId = String(formData.get('restaurantId') ?? '').trim();
  const roleRaw = String(formData.get('role') ?? '');

  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  const zoneId = String(formData.get('zoneId') ?? '').trim() || null;
  const isAreaLead = formData.get('isAreaLead') === '1';
  const service = createEmployeeMutationService({
    createEmployee: async () => userId,
    getRestaurantStatus,
    getRoleSlotConflictCode,
    updateEmployee,
  });
  const result = await service.updateEmployeeFromDraft({
    actorRestaurantId: ctx.profile.restaurant_id,
    actorRole: ctx.profile.role,
    input: {
      email,
      fullName,
      isAreaLead,
      password,
      restaurantId,
      roleRaw,
      zoneId,
    },
    targetRole: target.role,
    userId,
  });

  if (!result.ok) {
    if (result.errorCode === 'restaurant_mismatch') {
      redirect(employeesPathWithError(result.errorCode));
    }

    redirect(employeeDetailPathWithError(userId, result.errorCode));
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
