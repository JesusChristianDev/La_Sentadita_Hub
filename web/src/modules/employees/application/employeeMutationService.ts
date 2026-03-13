import type { AppRole } from '@/modules/auth_users';
import type { RestaurantStatus } from '@/modules/restaurants/application/getRestaurantStatus';

import type {
  CreateEmployeeValidatedInput,
  UpdateEmployeeValidatedInput,
} from './employeeMutationRules';
import {
  type CreateEmployeeDraftInput,
  type EditableEmployeeRole,
  type EmployeeMutationErrorCode,
  mapEmployeeMutationErrorCode,
  type UpdateEmployeeDraftInput,
  validateCreateEmployeeInput,
  validateScopedEmployeeManagement,
  validateUpdateEmployeeInput,
} from './employeeMutationRules';

type Result<T> =
  | { ok: true; value: T }
  | { ok: false; errorCode: EmployeeMutationErrorCode };

type EmployeeMutationServiceDeps = {
  createEmployee: (input: CreateEmployeeValidatedInput) => Promise<string>;
  getRestaurantStatus: (id: string) => Promise<RestaurantStatus | null>;
  getRoleSlotConflictCode: (
    restaurantId: string,
    role: Extract<EditableEmployeeRole, 'manager' | 'sub_manager'>,
    excludingUserId?: string,
  ) => Promise<'manager_exists' | 'sub_manager_exists' | null>;
  updateEmployee: (input: UpdateEmployeeValidatedInput & { userId: string }) => Promise<void>;
};

export function createEmployeeMutationService(deps: EmployeeMutationServiceDeps) {
  async function createEmployeeFromDraft(params: {
    effectiveRestaurantId: string | null;
    input: CreateEmployeeDraftInput;
  }): Promise<Result<string>> {
    const validated = validateCreateEmployeeInput(params.input);
    if (!validated.ok) {
      return validated;
    }

    if (!params.effectiveRestaurantId) {
      return { ok: false, errorCode: 'no_effective_restaurant' };
    }

    if (validated.value.restaurantId !== params.effectiveRestaurantId) {
      return { ok: false, errorCode: 'restaurant_mismatch' };
    }

    const status = await deps.getRestaurantStatus(validated.value.restaurantId);
    if (!status || !status.is_active) {
      return { ok: false, errorCode: 'restaurant_invalid' };
    }

    if (validated.value.role === 'manager' || validated.value.role === 'sub_manager') {
      const conflict = await deps.getRoleSlotConflictCode(
        validated.value.restaurantId,
        validated.value.role,
      );
      if (conflict) {
        return { ok: false, errorCode: conflict };
      }
    }

    try {
      return {
        ok: true,
        value: await deps.createEmployee(validated.value),
      };
    } catch (error) {
      const mapped = mapEmployeeMutationErrorCode(error);
      if (mapped) {
        return { ok: false, errorCode: mapped };
      }

      throw error;
    }
  }

  async function updateEmployeeFromDraft(params: {
    actorRestaurantId: string | null;
    actorRole: AppRole;
    input: UpdateEmployeeDraftInput;
    targetRole: string;
    userId: string;
  }): Promise<Result<void>> {
    const validated = validateUpdateEmployeeInput(params.input);
    if (!validated.ok) {
      return validated;
    }

    const scopedError = validateScopedEmployeeManagement({
      actorRestaurantId: params.actorRestaurantId,
      actorRole: params.actorRole,
      requestedRestaurantId: validated.value.restaurantId,
      requestedRole: validated.value.role,
      targetRole: params.targetRole,
    });
    if (scopedError) {
      return { ok: false, errorCode: scopedError };
    }

    const status = await deps.getRestaurantStatus(validated.value.restaurantId);
    if (!status || !status.is_active) {
      return { ok: false, errorCode: 'restaurant_invalid' };
    }

    if (validated.value.role === 'manager' || validated.value.role === 'sub_manager') {
      const conflict = await deps.getRoleSlotConflictCode(
        validated.value.restaurantId,
        validated.value.role,
        params.userId,
      );
      if (conflict) {
        return { ok: false, errorCode: conflict };
      }
    }

    try {
      await deps.updateEmployee({
        ...validated.value,
        userId: params.userId,
      });
      return { ok: true, value: undefined };
    } catch (error) {
      const mapped = mapEmployeeMutationErrorCode(error);
      if (mapped) {
        return { ok: false, errorCode: mapped };
      }

      throw error;
    }
  }

  return {
    createEmployeeFromDraft,
    updateEmployeeFromDraft,
  };
}
