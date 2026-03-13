'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { type AppRole, getCurrentUserContext } from '@/modules/auth_users';
import { createEmployee } from '@/modules/employees';
import { createEmployeeMutationService } from '@/modules/employees/application/employeeMutationService';
import {
  canCreate,
  getRoleSlotConflictCode,
  isAdminOrOffice,
} from '@/modules/employees/application/guards';
import { getRestaurantStatus } from '@/modules/restaurants';
import {
  employeesPathWithError,
  employeesPathWithSuccess,
} from '@/shared/feedbackMessages';

async function getEffectiveRestaurantId(
  role: AppRole,
  profileRestaurantId: string | null,
) {
  const store = await cookies();
  const active = store.get('active_restaurant_id')?.value ?? null;

  if (isAdminOrOffice(role)) return active ?? profileRestaurantId;
  return profileRestaurantId;
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
  const zoneId = String(formData.get('zoneId') ?? '').trim() || null;
  const isAreaLead = formData.get('isAreaLead') === '1';

  // Anti-tamper: el restaurante del form debe coincidir con el restaurante "efectivo" del server
  const effectiveRestaurantId = await getEffectiveRestaurantId(
    ctx.profile.role,
    ctx.profile.restaurant_id,
  );
  const service = createEmployeeMutationService({
    createEmployee,
    getRestaurantStatus,
    getRoleSlotConflictCode,
    updateEmployee: async () => undefined,
  });
  const result = await service.createEmployeeFromDraft({
    effectiveRestaurantId,
    input: {
      email,
      fullName,
      isAreaLead,
      password,
      restaurantId,
      roleRaw,
      zoneId,
    },
  });

  if (!result.ok) {
    redirect(employeesPathWithError(result.errorCode));
  }

  redirect(employeesPathWithSuccess('created'));
}
