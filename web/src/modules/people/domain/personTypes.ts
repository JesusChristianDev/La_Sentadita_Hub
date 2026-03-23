import type { SystemRole } from '@/modules/authz';

import type { PersonProfile } from './personProfile';

export type Person = PersonProfile & {
  system_role: SystemRole;
};

export type PersonIdentity = Pick<
  Person,
  'avatar_path' | 'employee_code' | 'full_name' | 'must_change_password'
>;

export type CreatePersonInput = {
  email: string;
  emailConfirm?: boolean;
  fullName: string;
  mustChangePassword?: boolean;
  password: string;
};

export type UpdatePersonIdentityInput = {
  avatarPath?: string | null;
  email?: string;
  fullName?: string;
  mustChangePassword?: boolean;
  password?: string;
  personId: string;
};

export type ArchivePersonInput = {
  personId: string;
  soft?: boolean;
};
