import { createLegacyPerson } from '@/shared/db/persons';

import type { CreatePersonInput } from '../domain/personTypes';

export async function createPerson(input: CreatePersonInput): Promise<string> {
  return createLegacyPerson({
    email: input.email,
    emailConfirm: input.emailConfirm,
    fullName: input.fullName,
    phone: input.phone,
    identityDocument: input.identityDocument,
    chainId: input.chainId,
    systemRole: input.systemRole,
    agoraEmployeeId: input.agoraEmployeeId,
  });
}