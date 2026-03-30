import 'server-only';

import { coerceSystemRole, type SystemRole } from '@/modules/authz';
import type { AccessStatus, PersonProfile } from '@/modules/people';
import { createSupabaseAdminClient } from '@/shared/supabase/admin';
import { createSupabaseServerClient } from '@/shared/supabase/server';

type PersonRow = {
  person_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  identity_document: string | null;
  avatar_url: string | null;
  system_role: string;
  is_archived: boolean;
  access_status: string | null;
  agora_employee_id: string | null;
};

type ActiveEmploymentRow = {
  restaurant_id: string;
};

type ActiveZoneScopeRow = {
  scope_id: string | null;
};

type RestaurantChainRow = {
  chain_id: string | null;
};

export type CreatePersonRecordInput = {
  email: string;
  emailConfirm?: boolean;
  fullName: string;
  phone: string;
  identityDocument: string;
  systemRole?: SystemRole;
  chainId: string;
  agoraEmployeeId?: string;
};

export type UpdatePersonIdentityRecordInput = {
  avatarPath?: string | null;
  fullName?: string;
  phone?: string;
  identityDocument?: string;
  personId: string;
};

export type UpdatePersonCredentialsInput = {
  email?: string;
  password?: string;
  personId: string;
};

export type ArchivePersonRecordInput = {
  personId: string;
  soft?: boolean;
};

const PERSON_ACCESS_STATUSES = [
  'pending_activation',
  'active',
  'suspended',
  'archived',
  'blocked',
] as const satisfies AccessStatus[];

function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim();
  if (!trimmed) return { firstName: 'SinNombre', lastName: '' };
  const [firstName, ...rest] = trimmed.split(/\s+/);
  return {
    firstName: firstName || 'SinNombre',
    lastName: rest.join(' '),
  };
}

export function formatProjectedPersonFullName(person: {
  first_name: string | null;
  last_name: string | null;
}): string {
  return [person.first_name, person.last_name].filter(Boolean).join(' ').trim();
}

function hasKeys(value: Record<string, unknown>): boolean {
  return Object.keys(value).length > 0;
}

function parseAccessStatus(
  value: string | undefined | null,
  isArchived: boolean,
): AccessStatus {
  if (typeof value === 'string' && PERSON_ACCESS_STATUSES.includes(value as AccessStatus)) {
    return value as AccessStatus;
  }

  return isArchived ? 'archived' : 'active';
}

export function isPersonAccessAllowed(accessStatus: AccessStatus): boolean {
  return accessStatus === 'active';
}

type ServerSupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export async function loadRestaurantChainIdByIdWithClient(
  supabase: ServerSupabaseClient,
  restaurantId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('restaurants')
    .select('chain_id')
    .eq('id', restaurantId)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to load restaurant chain: ${error.message}`);
  }

  return ((data ?? null) as RestaurantChainRow | null)?.chain_id ?? null;
}

export async function loadPersonProfileByIdWithClient(
  supabase: ServerSupabaseClient,
  personId: string,
): Promise<PersonProfile> {
  const [
    { data: person, error: personError },
    { data: employment, error: employmentError },
    { data: zoneScope, error: zoneScopeError },
  ] = await Promise.all([
    supabase
      .from('persons')
      .select(
        'person_id, first_name, last_name, email, phone, identity_document, avatar_url, system_role, is_archived, access_status',
      )
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

  if (personError && personError.code !== 'PGRST116') {
    throw new Error(`Failed to load person: ${personError.message}`);
  }
  if (employmentError && employmentError.code !== 'PGRST116') {
    throw new Error(`Failed to load employment: ${employmentError.message}`);
  }
  if (zoneScopeError && zoneScopeError.code !== 'PGRST116') {
    throw new Error(`Failed to load zone scope: ${zoneScopeError.message}`);
  }
  if (!person) {
    throw new Error(`Person not found: ${personId}`);
  }

  const p = person as PersonRow;
  const emp = (employment ?? null) as ActiveEmploymentRow | null;
  const zone = (zoneScope ?? null) as ActiveZoneScopeRow | null;
  const systemRole = coerceSystemRole(p.system_role);
  const accessStatus = parseAccessStatus(p.access_status, p.is_archived);
  const chainId = emp?.restaurant_id
    ? await loadRestaurantChainIdByIdWithClient(supabase, emp.restaurant_id)
    : null;

  const fullName = formatProjectedPersonFullName({
    first_name: p.first_name,
    last_name: p.last_name,
  });

  return {
    access_status: accessStatus,
    avatar_path: p.avatar_url ?? null,
    chain_id: chainId,
    employee_code: 0,
    full_name: fullName || '(sin nombre)',
    id: p.person_id,
    is_archived: p.is_archived,
    restaurant_id: emp?.restaurant_id ?? null,
    role: systemRole,
    system_role: systemRole,
    zone_id: zone?.scope_id ?? null,
  };
}

export async function loadPersonProfileById(personId: string): Promise<PersonProfile> {
  const supabase = await createSupabaseServerClient();
  return loadPersonProfileByIdWithClient(supabase, personId);
}

export async function loadPersonAccessState(
  personId: string,
): Promise<{ access_status: AccessStatus } | null> {
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .from('persons')
    .select('is_archived, access_status')
    .eq('person_id', personId)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to load person access state: ${error.message}`);
  }

  if (!data) return null;

  const p = data as Pick<PersonRow, 'access_status' | 'is_archived'>;
  return {
    access_status: parseAccessStatus(p.access_status, p.is_archived),
  };
}

export async function loadProjectedPersonDisplayName(
  personId: string,
): Promise<string | null> {
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .from('persons')
    .select('first_name, last_name')
    .eq('person_id', personId)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to load person display name: ${error.message}`);
  }

  if (!data) return null;

  const name = formatProjectedPersonFullName(data as Pick<PersonRow, 'first_name' | 'last_name'>);
  return name || null;
}

export async function createPersonRecord(input: CreatePersonRecordInput): Promise<string> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: input.email,
    email_confirm: input.emailConfirm ?? false,
  });

  if (error || !data.user) {
    throw new Error(`Failed to create auth user: ${error?.message ?? 'unknown error'}`);
  }

  const personId = data.user.id;
  const { firstName, lastName } = splitFullName(input.fullName);

  const { error: personError } = await admin.from('persons').insert({
    person_id: personId,
    chain_id: input.chainId,
    first_name: firstName,
    last_name: lastName,
    email: input.email,
    phone: input.phone,
    identity_document: input.identityDocument,
    system_role: input.systemRole ?? 'employee',
    access_status: 'pending_activation',
    is_archived: false,
    agora_employee_id: input.agoraEmployeeId ?? null,
  });

  if (personError) {
    await admin.auth.admin.deleteUser(personId, false);
    throw new Error(`Failed to create person: ${personError.message}`);
  }

  return personId;
}

export async function updatePersonIdentityRecord(
  input: UpdatePersonIdentityRecordInput,
): Promise<void> {
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.avatarPath !== undefined) patch.avatar_url = input.avatarPath;
  if (input.fullName !== undefined) {
    const { firstName, lastName } = splitFullName(input.fullName);
    patch.first_name = firstName;
    patch.last_name = lastName;
  }
  if (input.phone !== undefined) patch.phone = input.phone;
  if (input.identityDocument !== undefined) patch.identity_document = input.identityDocument;

  if (Object.keys(patch).length <= 1) return;

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from('persons')
    .update(patch)
    .eq('person_id', input.personId);

  if (error) {
    throw new Error(`Failed to update person identity: ${error.message}`);
  }
}

export async function updatePersonCredentials(
  input: UpdatePersonCredentialsInput,
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
      .update({ email: input.email, updated_at: new Date().toISOString() })
      .eq('person_id', input.personId);

    if (personError) {
      throw new Error(`Failed to sync person email: ${personError.message}`);
    }
  }
}

export async function archivePersonRecord(input: ArchivePersonRecordInput): Promise<void> {
  const admin = createSupabaseAdminClient();
  const soft = input.soft ?? true;
  const timestamp = new Date().toISOString();

  const { error: authError } = await admin.auth.admin.deleteUser(input.personId, soft);
  if (authError) {
    throw new Error(`Failed to archive auth user: ${authError.message}`);
  }

  const { error: personError } = await admin
    .from('persons')
    .update({
      is_archived: true,
      access_status: 'archived',
      deleted_at: timestamp,
      updated_at: timestamp,
    })
    .eq('person_id', input.personId);

  if (personError) {
    throw new Error(`Failed to archive person: ${personError.message}`);
  }
}
