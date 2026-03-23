import { cn } from '@/shared/utils';

export function cx(...values: Array<string | false | null | undefined>) {
  return cn(...values);
}
