import type { EditableEmploymentSystemRole } from './employeeMutationRules';
import { mapEmployeeMutationErrorCode } from './employeeMutationRules';

export type CreateRelationshipInput = {
  email: string;
  emailConfirm?: boolean;
  fullName: string;
  phone: string;
  identityDocument: string;
  role: EditableEmploymentSystemRole;
  zoneId: string | null;
  restaurantId: string;
};

type ArchiveInput = { personId: string; soft?: boolean };

type UpdateProjectionInput = {
  personId: string;
  restaurantId: string;
  role: EditableEmploymentSystemRole;
  zoneId: string | null;
};

export type CreateRelationshipDeps = {
  createPerson: (input: {
    email: string;
    emailConfirm?: boolean;
    fullName: string;
    phone: string;
    identityDocument: string;
    systemRole: EditableEmploymentSystemRole;
  }) => Promise<string>;
  archivePerson: (input: ArchiveInput) => Promise<void>;
  updateEmploymentProjection: (input: UpdateProjectionInput) => Promise<void>;
};

export function createRelationshipService(deps: CreateRelationshipDeps) {
  return async function execute(input: CreateRelationshipInput): Promise<string> {
    let personId: string | undefined;
    try {
      personId = await deps.createPerson({
        email: input.email,
        emailConfirm: input.emailConfirm ?? false,
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
