import {
  updateLegacyPersonCredentials,
  updateLegacyPersonIdentity,
} from '@/shared/db/persons';

import type { UpdatePersonIdentityInput } from '../domain/personTypes';

export async function updatePersonIdentity(
  input: UpdatePersonIdentityInput,
): Promise<void> {
  await updateLegacyPersonIdentity({
    avatarPath: input.avatarPath,
    fullName: input.fullName,
    mustChangePassword: input.mustChangePassword,
    personId: input.personId,
  });

  await updateLegacyPersonCredentials({
    email: input.email,
    password: input.password,
    personId: input.personId,
  });
}
