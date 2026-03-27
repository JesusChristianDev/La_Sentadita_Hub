import {
  updatePersonCredentials,
  updatePersonIdentity,
} from '@/shared/db/persons';

import type { UpdatePersonIdentityInput } from '../domain/personTypes';

export async function updatePersonIdentity(
  input: UpdatePersonIdentityInput,
): Promise<void> {
  await updatePersonIdentity({
    avatarPath: input.avatarPath,
    fullName: input.fullName,
    mustChangePassword: input.mustChangePassword,
    personId: input.personId,
  });

  await updatePersonCredentials({
    email: input.email,
    password: input.password,
    personId: input.personId,
  });
}
