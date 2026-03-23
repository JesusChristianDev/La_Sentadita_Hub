import { setLegacyEmploymentActive } from '@/shared/db/employment';

export async function setEmploymentActive(
  personId: string,
  isActive: boolean,
): Promise<void> {
  await setLegacyEmploymentActive(personId, isActive);
}

export const setEmployeeActive = setEmploymentActive;
