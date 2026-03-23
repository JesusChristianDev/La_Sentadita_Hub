import { archivePerson, createPerson } from '@/modules/people';
import { updateLegacyEmployment } from '@/shared/db/employment';

import type { CreateEmployeeValidatedInput } from './employeeMutationRules';
import { mapEmployeeMutationErrorCode } from './employeeMutationRules';

export async function createEmploymentRelationship(
  input: CreateEmployeeValidatedInput,
): Promise<string> {
  const personId = await createPerson({
    email: input.email,
    emailConfirm: true,
    fullName: input.fullName,
    mustChangePassword: true,
    password: input.password,
  });

  try {
    await updateLegacyEmployment({
      personId,
      restaurantId: input.restaurantId,
      role: input.role,
      zoneId: input.zoneId,
    });

    return personId;
  } catch (error) {
    await archivePerson({
      personId,
      soft: false,
    }).catch(() => undefined);

    const mapped = mapEmployeeMutationErrorCode(error);
    if (mapped) {
      throw new Error(mapped);
    }

    throw error;
  }
}

export const createEmployee = createEmploymentRelationship;
