import { setEmploymentActiveProjection } from '@/shared/db/employment';

export async function setEmploymentActive(
  personId: string,
  isActive: boolean,
): Promise<void> {
  await setEmploymentActiveProjection(personId, isActive);
}

export const setEmployeeActive = setEmploymentActive;
