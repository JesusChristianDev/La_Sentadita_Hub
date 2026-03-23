import { setLegacyEmploymentActive } from '@/shared/db/employment';

export async function terminateEmployment(personId: string): Promise<void> {
  await setLegacyEmploymentActive(personId, false);
}
