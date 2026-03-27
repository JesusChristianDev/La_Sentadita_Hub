import { setEmploymentActive } from '@/shared/db/employment';

export async function terminateEmployment(personId: string): Promise<void> {
  await setEmploymentActive(personId, false);
}
