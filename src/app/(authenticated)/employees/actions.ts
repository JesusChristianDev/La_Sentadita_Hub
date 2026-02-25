'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { assignAreaLead } from '@/modules/area_leads';
import { type AppRole, getCurrentUserContext } from '@/modules/auth_users';
import { createEmployee, deleteEmployee } from '@/modules/employees';
import {
  assertRoleSlotAvailable,
  canCreate,
  isAdminOrOffice,
  isStrongPassword,
  isValidEmail,
  parseRole,
  parseZone,
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
  const role = parseRole(roleRaw);
  const assignAreaLeadRaw = String(formData.get('assignAreaLead') ?? '');
  const zone = parseZone(String(formData.get('zone') ?? ''));
  const shouldAssignAreaLead = assignAreaLeadRaw === '1';

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

  if (shouldAssignAreaLead && role !== 'employee') {
    redirect(employeesPathWithError('area_lead_only_employee'));
  }

  if (shouldAssignAreaLead && !zone) {
    redirect(employeesPathWithError('missing'));
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

  let createdUserId: string | null = null;

  try {
    createdUserId = await createEmployee({
      email,
      fullName,
      password,
      restaurantId,
      role,
    });

    if (shouldAssignAreaLead && zone) {
      await assignAreaLead({
        restaurantId,
        zone,
        userId: createdUserId,
        assignedBy: ctx.profile.id,
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    if (msg === 'area_lead_zone_full' && createdUserId) {
      try {
        await deleteEmployee(createdUserId, { soft: true });
      } catch (rollbackErr) {
        const rollbackMsg =
          rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr);
        throw new Error(
          `Failed to rollback created user after zone assignment error: ${rollbackMsg}`,
        );
      }
    }

    if (msg === 'sub_manager_exists') {
      redirect(employeesPathWithError('sub_manager_exists'));
    }
    if (msg === 'manager_exists') {
      redirect(employeesPathWithError('manager_exists'));
    }
    if (msg === 'area_lead_zone_full') {
      redirect(employeesPathWithError('area_lead_zone_full'));
    }

    throw err; // lo demás sí es bug real
  }

  redirect(employeesPathWithSuccess('created'));
}
