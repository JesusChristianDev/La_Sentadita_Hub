import { createPersonRecord } from '@/shared/db/persons';

import type { CreatePersonInput } from '../domain/personTypes';

export async function createPerson(input: CreatePersonInput): Promise<string> {
  return createPersonRecord({
    email: input.email,
    emailConfirm: input.emailConfirm,
    fullName: input.fullName,
    phone: input.phone,
    identityDocument: input.identityDocument,
    systemRole: input.systemRole,
    agoraEmployeeId: input.agoraEmployeeId,
  });
}
