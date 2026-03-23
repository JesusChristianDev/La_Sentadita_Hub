import { archivePerson, createPerson } from '@/modules/people';
import { updateLegacyEmployment } from '@/shared/db/employment';

import type { CreateEmployeeValidatedInput } from './employeeMutationRules';
import { mapEmployeeMutationErrorCode } from './employeeMutationRules';

export async function createEmploymentRelationship(
  input: CreateEmployeeValidatedInput,
): Promise<string> {
  // v6: sin password — Supabase envía email de activación automáticamente
  const personId = await createPerson({
    email: input.email,
    emailConfirm: false, // false = envía email de activación al empleado
    fullName: input.fullName,
    phone: input.phone,
    identityDocument: input.identityDocument,
    chainId: input.chainId,
    systemRole: input.role,
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
    // Rollback: si falla el empleo, archivar la persona recién creada
    await archivePerson({
      personId,
      soft: false,
    }).catch(() => undefined);

    const mapped = mapEmployeeMutationErrorCode(error);
    if (mapped) throw new Error(mapped);

    throw error;
  }
}

export const createEmployee = createEmploymentRelationship;