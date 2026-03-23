'use server';

import { redirect } from 'next/navigation';

import { getCurrentUserContext } from '@/modules/auth_users';
import { canCreate, getRoleSlotConflictCode } from '@/modules/employees/application/guards';
import { createEmployee, createEmployeeMutationService } from '@/modules/employment';
import { getRestaurantStatus } from '@/modules/restaurants';
import {
  employeesPathWithError,
  employeesPathWithSuccess,
} from '@/shared/feedbackMessages';

export async function createEmployeeAction(formData: FormData) {
  const ctx = await getCurrentUserContext();
  if (!ctx) redirect('/login');

  if (!canCreate(ctx.requestContext)) redirect('/employees');

  // chainId viene del contexto del usuario autenticado, no del form
  const chainId = ctx.requestContext.chainId;
  if (!chainId) redirect(employeesPathWithError('missing'));

  const email = String(formData.get('email') ?? '').trim();
  const fullName = String(formData.get('fullName') ?? '').trim();
  const phone = String(formData.get('phone') ?? '').trim();
  const identityDocument = String(formData.get('identityDocument') ?? '').trim();
  const restaurantId = String(formData.get('restaurantId') ?? '').trim();
  const roleRaw = String(formData.get('role') ?? '');
  const zoneId = String(formData.get('zoneId') ?? '').trim() || null;

  const service = createEmployeeMutationService({
    createEmployee,
    getRestaurantStatus,
    getRoleSlotConflictCode,
    updateEmployee: async () => undefined,
  });

  const result = await service.createEmployeeFromDraft({
    chainId,
    effectiveRestaurantId: ctx.requestContext.effectiveRestaurantId,
    input: {
      email,
      fullName,
      phone,
      identityDocument,
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