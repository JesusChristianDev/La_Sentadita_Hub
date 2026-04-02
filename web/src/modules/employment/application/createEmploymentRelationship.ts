import { archivePerson, createPerson } from '@/modules/people';
import { updateEmploymentProjection } from '@/shared/db/employment';

import type { CreateEmployeeValidatedInput } from './employeeMutationRules';
import { mapEmployeeMutationErrorCode } from './employeeMutationRules';

export async function createEmploymentRelationship(
  input: CreateEmployeeValidatedInput,
): Promise<string> {
  let personId: string | undefined;
  try {
    personId = await createPerson({
      email: input.email,
      emailConfirm: false, // false = envía email de activación al empleado
      fullName: input.fullName,
      phone: input.phone,
      identityDocument: input.identityDocument,
      systemRole: input.role,
    });

    await updateEmploymentProjection({
      personId,
      restaurantId: input.restaurantId,
      role: input.role,
      zoneId: input.zoneId,
    });

    return personId;
  } catch (error) {
    if (personId) {
      // Rollback: si falla el empleo posterior al alta, archivar la persona
      await archivePerson({
        personId,
        soft: false,
      }).catch(() => undefined);
    }

    const mapped = mapEmployeeMutationErrorCode(error);
    if (mapped) throw new Error(mapped);

    throw error;
  }
}

export const createEmployee = createEmploymentRelationship;
