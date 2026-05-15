import type { EditableEmploymentSystemRole } from './employeeMutationRules';
import { mapEmployeeMutationErrorCode } from './employeeMutationRules';

type UpdatePersonIdentityInput = {
  email?: string;
  fullName: string;
  password?: string;
  personId: string;
};

type UpdateProjectionInput = {
  personId: string;
  restaurantId: string;
  role: EditableEmploymentSystemRole;
  zoneId: string | null;
};

export type UpdateEmploymentServiceDeps = {
  updatePersonIdentity: (input: UpdatePersonIdentityInput) => Promise<void>;
  updateEmploymentProjection: (input: UpdateProjectionInput) => Promise<void>;
};

export type UpdateEmploymentServiceInput = {
  userId: string;
  email?: string;
  fullName: string;
  password?: string;
  restaurantId: string;
  role: EditableEmploymentSystemRole;
  zoneId: string | null;
};

export function updateEmploymentService(deps: UpdateEmploymentServiceDeps) {
  return async function execute(input: UpdateEmploymentServiceInput): Promise<void> {
    await deps.updatePersonIdentity({
      email: input.email,
      fullName: input.fullName,
      password: input.password,
      personId: input.userId,
    });

    try {
      await deps.updateEmploymentProjection({
        personId: input.userId,
        restaurantId: input.restaurantId,
        role: input.role,
        zoneId: input.zoneId,
      });
    } catch (error) {
      const mapped = mapEmployeeMutationErrorCode(error);
      if (mapped) throw new Error(mapped);
      throw error;
    }
  };
}
