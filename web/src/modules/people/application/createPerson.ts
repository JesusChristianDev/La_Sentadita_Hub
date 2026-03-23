import { createLegacyPerson } from '@/shared/db/persons';

import type { CreatePersonInput } from '../domain/personTypes';

export async function createPerson(input: CreatePersonInput): Promise<string> {
  return createLegacyPerson(input);
}
