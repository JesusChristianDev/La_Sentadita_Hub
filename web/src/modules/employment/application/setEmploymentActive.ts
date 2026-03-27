import { setEmploymentActive } from '@/shared/db/employment';

export async function setEmploymentActive(
  personId: string,
  isActive: boolean,
): Promise<void> {
  await setEmploymentActive(personId, isActive);
}

export const setEmployeeActive = setEmploymentActive;
