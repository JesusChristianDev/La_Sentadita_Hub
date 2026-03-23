import 'server-only';

import type { SystemRole } from '@/modules/authz';
import type { PersonProfile } from '@/modules/people';
import { createSupabaseAdminClient } from '@/shared/supabase/admin';
import { createSupabaseServerClient } from '@/shared/supabase/server';

const LEGACY_PERSON_PROFILE_SELECT =
  'id, role, restaurant_id, employee_code, full_name, avatar_path, must_change_password, is_active, zone_id';

type ServerSupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type PersonRoleProjectionRow = {
  avatar_url: string | null;
  first_name: string;
  is_archived: boolean;
  last_name: string;
  person_id: string;
  system_role: SystemRole;
};

type ActiveEmploymentScopeRow = {
  restaurant_id: string | null;
};

type ActiveZoneScopeRow = {
  scope_id: string | null;
};

type PersonDisplayProjectionRow = {
  first_name: string;
  last_name: string;
  person_id: string;
};

type CreateLegacyPersonInput = {
  email: string;
  emailConfirm?: boolean;
  fullName: string;
  mustChangePassword?: boolean;
  password: string;
};

type UpdateLegacyPersonIdentityInput = {
  avatarPath?: string | null;
  fullName?: string;
  mustChangePassword?: boolean;
  personId: string;
};

type UpdateLegacyPersonCredentialsInput = {
  email?: string;
  password?: string;
  personId: string;
};

type ArchiveLegacyPersonInput = {
  personId: string;
  soft?: boolean;
};

type PersonAccessStateRow = {
  id?: string;
  is_active: boolean;
};

const LEGACY_MIGRATED_CHAIN_ID = '00000000-0000-0000-0000-000000000001';

function hasKeys(value: Record<string, unknown>): boolean {
  return Object.keys(value).length > 0;
}

function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim();
  if (!trimmed) {
    return {
      firstName: 'SinNombre',
      lastName: '',
    };
  }

  const [firstName, ...rest] = trimmed.split(/\s+/);
  return {
    firstName: firstName || 'SinNombre',
    lastName: rest.join(' '),
  };
}

export function mapSystemRoleToLegacyProfileRole(systemRole: SystemRole): PersonProfile['role'] {
  return systemRole;
}

export function formatProjectedPersonFullName(person: {
  first_name: string | null;
  last_name: string | null;
}): string {
  return [person.first_name, person.last_name].filter(Boolean).join(' ').trim();
}

export async function loadLegacyPersonProfileByIdWithClient(
  supabase: ServerSupabaseClient,
  personId: string,
): Promise<PersonProfile> {
  const [
    { data, error },
    { data: personProjection, error: personError },
    { data: employmentProjection, error: employmentError },
    { data: zoneScopeProjection, error: zoneScopeError },
  ] =
    await Promise.all([
      supabase
        .from('profiles')
        .select(LEGACY_PERSON_PROFILE_SELECT)
        .eq('id', personId)
        .maybeSingle(),
      supabase
        .from('persons')
        .select('person_id, first_name, last_name, avatar_url, system_role, is_archived')
        .eq('person_id', personId)
        .maybeSingle(),
      supabase
        .from('employment_relationships')
        .select('restaurant_id')
        .eq('person_id', personId)
        .eq('active_principal', true)
        .eq('is_archived', false)
        .maybeSingle(),
      supabase
        .from('role_scope_assignments')
        .select('scope_id')
        .eq('person_id', personId)
        .eq('scope_type', 'zone')
        .eq('active', true)
        .maybeSingle(),
    ]);

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to load person profile: ${error.message}`);
  }

  if (personError && personError.code !== 'PGRST116') {
    throw new Error(`Failed to load person projection: ${personError.message}`);
  }

  if (employmentError && employmentError.code !== 'PGRST116') {
    throw new Error(`Failed to load employment scope projection: ${employmentError.message}`);
  }

  if (zoneScopeError && zoneScopeError.code !== 'PGRST116') {
    throw new Error(`Failed to load zone scope projection: ${zoneScopeError.message}`);
  }

  const projectedPerson = (personProjection ?? null) as PersonRoleProjectionRow | null;
  const projectedEmployment = (employmentProjection ?? null) as ActiveEmploymentScopeRow | null;
  const projectedZoneScope = (zoneScopeProjection ?? null) as ActiveZoneScopeRow | null;
  if (!data && !projectedPerson) {
    throw new Error('Failed to load person profile: not found');
  }

  const projectedFullName = formatProjectedPersonFullName({
    first_name: projectedPerson?.first_name ?? null,
    last_name: projectedPerson?.last_name ?? null,
  });
  const profile = ((data ?? {
    avatar_path: projectedPerson?.avatar_url ?? null,
    employee_code: 0,
    full_name: projectedFullName || '(sin nombre)',
    id: personId,
    is_active: projectedPerson?.is_archived !== true,
    must_change_password: false,
    restaurant_id: null,
    role: projectedPerson
      ? projectedPerson.system_role
      : 'employee',
    zone_id: null,
  }) as PersonProfile);
  const projectedRole = projectedPerson
    ? { role: projectedPerson.system_role }
    : { role: profile.role };
  const resolvedFullName = profile.full_name?.trim() || projectedFullName;
  const isArchived =
    projectedPerson?.is_archived === true || profile.is_active === false;

  return {
    ...profile,
    avatar_path: profile.avatar_path ?? projectedPerson?.avatar_url ?? null,
    full_name: resolvedFullName || profile.full_name,
    is_active: profile.is_active && !isArchived,
    is_archived: isArchived,
    restaurant_id: projectedEmployment?.restaurant_id ?? profile.restaurant_id ?? null,
    role: projectedRole.role,
    system_role: projectedPerson?.system_role ?? profile.role,
    zone_id: projectedZoneScope?.scope_id ?? profile.zone_id ?? null,
  };
}

export async function loadLegacyPersonProfileById(
  personId: string,
): Promise<PersonProfile> {
  const supabase = await createSupabaseServerClient();
  return loadLegacyPersonProfileByIdWithClient(supabase, personId);
}

export async function loadProjectedPersonDisplayName(
  personId: string,
): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('persons')
    .select('person_id, first_name, last_name')
    .eq('person_id', personId)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to load person display projection: ${error.message}`);
  }

  if (!data) return null;

  const typed = data as PersonDisplayProjectionRow;
  const displayName = formatProjectedPersonFullName(typed);
  return displayName || null;
}

export async function loadLegacyPersonAccessState(
  personId: string,
): Promise<{ is_active: boolean; is_archived: boolean } | null> {
  const admin = createSupabaseAdminClient();
  const [{ data: person, error: personError }, { data: profile, error: profileError }] =
    await Promise.all([
      admin
        .from('persons')
        .select('is_archived')
        .eq('person_id', personId)
        .maybeSingle(),
      admin
        .from('profiles')
        .select('id, is_active')
        .eq('id', personId)
        .maybeSingle(),
    ]);

  if (personError && personError.code !== 'PGRST116') {
    throw new Error(`Failed to load person archive state: ${personError.message}`);
  }

  if (profileError && profileError.code !== 'PGRST116') {
    throw new Error(`Failed to load person access state: ${profileError.message}`);
  }

  if (!profile && !person) return null;

  const typedProfile = (profile ?? null) as PersonAccessStateRow | null;
  const typedPerson = (person ?? null) as { is_archived?: boolean } | null;
  const isArchived =
    typedPerson?.is_archived === true || typedProfile?.is_active === false;

  return {
    is_active: (typedProfile?.is_active ?? true) && !isArchived,
    is_archived: isArchived,
  };
}

export async function createLegacyPerson(
  input: CreateLegacyPersonInput,
): Promise<string> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: input.email,
    email_confirm: input.emailConfirm ?? true,
    password: input.password,
  });

  if (error || !data.user) {
    throw new Error(`Failed to create user: ${error?.message ?? 'unknown error'}`);
  }

  const personId = data.user.id;
  const { firstName, lastName } = splitFullName(input.fullName);
  const { error: personError } = await admin
    .from('persons')
    .upsert({
      chain_id: LEGACY_MIGRATED_CHAIN_ID,
      email: input.email,
      first_name: firstName,
      is_archived: false,
      last_name: lastName,
      person_id: personId,
      system_role: 'employee',
    });

  if (personError) {
    await admin.auth.admin.deleteUser(personId, false);
    throw new Error(`Failed to initialize person projection: ${personError.message}`);
  }

  const { error: profileError } = await admin
    .from('profiles')
    .update({
      full_name: input.fullName,
      must_change_password: input.mustChangePassword ?? false,
    })
    .eq('id', personId);

  if (!profileError) {
    return personId;
  }

  await admin.auth.admin.deleteUser(personId, false);
  throw new Error(`Failed to initialize person profile: ${profileError.message}`);
}

export async function updateLegacyPersonIdentity(
  input: UpdateLegacyPersonIdentityInput,
): Promise<void> {
  const patch: Record<string, unknown> = {};
  const personPatch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.avatarPath !== undefined) {
    personPatch.avatar_url = input.avatarPath;
  }

  if (input.fullName !== undefined) {
    const { firstName, lastName } = splitFullName(input.fullName);
    personPatch.first_name = firstName;
    personPatch.last_name = lastName;
  }

  if (input.avatarPath !== undefined) patch.avatar_path = input.avatarPath;
  if (input.fullName !== undefined) patch.full_name = input.fullName;
  if (input.mustChangePassword !== undefined) {
    patch.must_change_password = input.mustChangePassword;
  }

  if (!hasKeys(patch) && !hasKeys(personPatch)) return;

  const admin = createSupabaseAdminClient();

  if (hasKeys(personPatch)) {
    const { error: personError } = await admin
      .from('persons')
      .update(personPatch)
      .eq('person_id', input.personId);

    if (personError) {
      throw new Error(`Failed to sync person identity: ${personError.message}`);
    }
  }

  if (!hasKeys(patch)) return;

  const { error } = await admin.from('profiles').update(patch).eq('id', input.personId);

  if (error) {
    throw new Error(`Failed to update person identity bridge: ${error.message}`);
  }
}

export async function updateLegacyPersonCredentials(
  input: UpdateLegacyPersonCredentialsInput,
): Promise<void> {
  const attributes: { email?: string; password?: string } = {};
  if (input.email) attributes.email = input.email;
  if (input.password) attributes.password = input.password;

  if (!hasKeys(attributes)) return;

  const admin = createSupabaseAdminClient();
  const { error } = await admin.auth.admin.updateUserById(input.personId, attributes);

  if (error) {
    throw new Error(`Failed to update person credentials: ${error.message}`);
  }

  if (input.email) {
    const { error: personError } = await admin
      .from('persons')
      .update({
        email: input.email,
        updated_at: new Date().toISOString(),
      })
      .eq('person_id', input.personId);

    if (personError) {
      throw new Error(`Failed to sync person email: ${personError.message}`);
    }
  }
}

export async function archiveLegacyPerson(
  input: ArchiveLegacyPersonInput,
): Promise<void> {
  const admin = createSupabaseAdminClient();
  const soft = input.soft ?? true;
  const timestamp = new Date().toISOString();

  const { error: authError } = await admin.auth.admin.deleteUser(input.personId, soft);
  if (authError) {
    throw new Error(`Failed to archive person auth user: ${authError.message}`);
  }

  const { error: profileError } = await admin
    .from('profiles')
    .update({
      deleted_at: timestamp,
      is_active: false,
    })
    .eq('id', input.personId);

  if (profileError) {
    throw new Error(`Failed to archive person profile: ${profileError.message}`);
  }

  const { error: personError } = await admin
    .from('persons')
    .update({
      deleted_at: timestamp,
      is_archived: true,
      updated_at: timestamp,
    })
    .eq('person_id', input.personId);

  if (personError) {
    throw new Error(`Failed to sync archived person projection: ${personError.message}`);
  }
}
