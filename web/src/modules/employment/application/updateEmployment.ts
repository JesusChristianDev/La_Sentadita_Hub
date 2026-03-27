import { updatePersonIdentity } from '@/modules/people';
import { updateEmployment } from '@/shared/db/employment';

import type { UpdateEmployeeValidatedInput } from './employeeMutationRules';
import { mapEmployeeMutationErrorCode } from './employeeMutationRules';

export type UpdateEmploymentInput = UpdateEmployeeValidatedInput & {
  userId: string;
};

export async function updateEmployment(input: UpdateEmploymentInput): Promise<void> {
  await updatePersonIdentity({
    email: input.email,
    fullName: input.fullName,
    password: input.password,
    personId: input.userId,
  });

  try {
    await updateEmployment({
      personId: input.userId,
      restaurantId: input.restaurantId,
      role: input.role,
      zoneId: input.zoneId,
    });
  } catch (error) {
    const mapped = mapEmployeeMutationErrorCode(error);
    if (mapped) {
      throw new Error(mapped);
    }

    throw error;
  }
}

export const updateEmployee = updateEmployment;
