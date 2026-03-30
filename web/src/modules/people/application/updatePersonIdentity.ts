import {
  updatePersonCredentials,
  updatePersonIdentityRecord,
} from '@/shared/db/persons';

import type { UpdatePersonIdentityInput } from '../domain/personTypes';

export async function updatePersonIdentity(
  input: UpdatePersonIdentityInput,
): Promise<void> {
  await updatePersonIdentityRecord({
    avatarPath: input.avatarPath,
    fullName: input.fullName,
    personId: input.personId,
  });

  await updatePersonCredentials({
    email: input.email,
    password: input.password,
    personId: input.personId,
  });
}
