import { archivePersonRecord } from '@/shared/db/persons';

import type { ArchivePersonInput } from '../domain/personTypes';

export async function archivePerson(input: ArchivePersonInput): Promise<void> {
  await archivePersonRecord(input);
}
