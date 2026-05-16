import type { ArchivePersonInput, CreatePersonInput } from '@/modules/people';
import { archivePerson, createPerson } from '@/modules/people';
import { updateEmploymentProjection } from '@/shared/db/employment';

import type { CreateEmployeeValidatedInput, EditableEmploymentSystemRole } from './employeeMutationRules';
import { mapEmployeeMutationErrorCode } from './employeeMutationRules';

type UpdateProjectionInput = {
  personId: string;
  restaurantId: string;
  role: EditableEmploymentSystemRole;
  zoneId: string | null;
};

type CreateRelationshipDeps = {
  createPerson: (input: CreatePersonInput) => Promise<string>;
  archivePerson: (input: ArchivePersonInput) => Promise<void>;
  updateEmploymentProjection: (input: UpdateProjectionInput) => Promise<void>;
};

export function createRelationshipService(deps: CreateRelationshipDeps) {
  return async function executeCreateRelationship(
    input: CreateEmployeeValidatedInput,
  ): Promise<string> {
    let personId: string | undefined;
    try {
      personId = await deps.createPerson({
        email: input.email,
        emailConfirm: false,
        fullName: input.fullName,
        phone: input.phone,
        identityDocument: input.identityDocument,
        systemRole: input.role,
      });

      await deps.updateEmploymentProjection({
        personId,
        restaurantId: input.restaurantId,
        role: input.role,
        zoneId: input.zoneId,
      });

      return personId;
    } catch (error) {
      if (personId) {
        await deps.archivePerson({ personId, soft: false }).catch(() => undefined);
      }

      const mapped = mapEmployeeMutationErrorCode(error);
      if (mapped) throw new Error(mapped);

      throw error;
    }
  };
}

export async function createEmploymentRelationship(
  input: CreateEmployeeValidatedInput,
): Promise<string> {
  return createRelationshipService({
    archivePerson,
    createPerson,
    updateEmploymentProjection,
  })(input);
}

export const createEmployee = createEmploymentRelationship;
