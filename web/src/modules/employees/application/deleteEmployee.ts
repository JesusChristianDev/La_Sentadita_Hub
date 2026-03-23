import { archivePerson } from '@/modules/people';

export async function deleteEmployee(userId: string, opts?: { soft?: boolean }) {
  await archivePerson({
    personId: userId,
    soft: opts?.soft,
  });
}
