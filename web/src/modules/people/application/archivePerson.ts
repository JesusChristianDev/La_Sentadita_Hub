import { archiveLegacyPerson } from '@/shared/db/persons';

import type { ArchivePersonInput } from '../domain/personTypes';

export async function archivePerson(input: ArchivePersonInput): Promise<void> {
  await archiveLegacyPerson(input);
}
