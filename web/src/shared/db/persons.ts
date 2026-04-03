import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { AccessStatus, PersonProfile } from '@/modules/people';
import { coerceSystemRole, type SystemRole } from '@/shared/authz';

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

type EmploymentRow = {
  company_id: string;
  employment_id: string;
  valid_from: string;
  valid_to: string | null;
  is_archived: boolean;
  deleted_at: string | null;
};

type RestaurantAssignmentRow = {
  employment_id: string;
  restaurant_id: string;
  valid_from: string;
  valid_to: string | null;
  created_at: string;
};

type ZoneAssignmentRow = {
  employment_id: string;
  zone_id: string;
  valid_from: string;
  valid_to: string | null;
  created_at: string;
};

type CompanyRow = {
  chain_id: string | null;
};

export type CreatePersonRecordInput = {
  email: string;
  emailConfirm?: boolean;
  fullName: string;
  phone: string;
  identityDocument: string;
  systemRole?: SystemRole;
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

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function isCurrentTemporalRow(
  row: { valid_from: string; valid_to: string | null },
  today = todayIsoDate(),
): boolean {
  return row.valid_from <= today && (row.valid_to === null || row.valid_to >= today);
}

function sortTemporalDesc<T extends { created_at?: string | null; valid_from: string }>(
  rows: T[],
): T[] {
  return [...rows].sort(
    (left, right) =>
      right.valid_from.localeCompare(left.valid_from) ||
      (right.created_at ?? '').localeCompare(left.created_at ?? ''),
  );
}

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
type QueryClient = Pick<ServerSupabaseClient, 'from'>;

async function loadLatestOperationalSnapshot(
  supabase: QueryClient,
  personId: string,
): Promise<{ chainId: string | null; restaurantId: string | null; zoneId: string | null }> {
  const today = todayIsoDate();
  const { data: employmentRows, error: employmentError } = await supabase
    .from('employment_relationships')
    .select('employment_id, company_id, valid_from, valid_to, is_archived, deleted_at')
    .eq('person_id', personId)
    .order('valid_from', { ascending: false });

  if (employmentError) {
    throw new Error(`Failed to load employment: ${employmentError.message}`);
  }

  const employment = ((employmentRows ?? []) as EmploymentRow[])
    .filter((row) => !row.is_archived && row.deleted_at === null)
    .find((row) => isCurrentTemporalRow(row, today)) ??
    ((employmentRows ?? []) as EmploymentRow[])
      .filter((row) => !row.is_archived && row.deleted_at === null)[0] ??
    null;

  if (!employment) {
    return { chainId: null, restaurantId: null, zoneId: null };
  }

  const [{ data: restaurantAssignments, error: restaurantError }, { data: zoneAssignments, error: zoneError }, { data: companyData, error: companyError }] =
    await Promise.all([
      supabase
        .from('employment_restaurant_assignments')
        .select('employment_id, restaurant_id, valid_from, valid_to, created_at')
        .eq('employment_id', employment.employment_id)
        .order('valid_from', { ascending: false }),
      supabase
        .from('employment_zone_assignments')
        .select('employment_id, zone_id, valid_from, valid_to, created_at')
        .eq('employment_id', employment.employment_id)
        .order('valid_from', { ascending: false }),
      supabase
        .from('companies')
        .select('chain_id')
        .eq('company_id', employment.company_id)
        .maybeSingle(),
    ]);

  if (restaurantError) {
    throw new Error(`Failed to load restaurant assignment: ${restaurantError.message}`);
  }
  if (zoneError) {
    throw new Error(`Failed to load zone assignment: ${zoneError.message}`);
  }
  if (companyError && companyError.code !== 'PGRST116') {
    throw new Error(`Failed to load company: ${companyError.message}`);
  }

  const restaurantAssignment =
    ((restaurantAssignments ?? []) as RestaurantAssignmentRow[]).find((row) =>
      isCurrentTemporalRow(row, today),
    ) ?? sortTemporalDesc((restaurantAssignments ?? []) as RestaurantAssignmentRow[])[0] ?? null;
  const zoneAssignment =
    ((zoneAssignments ?? []) as ZoneAssignmentRow[]).find((row) =>
      isCurrentTemporalRow(row, today),
    ) ?? sortTemporalDesc((zoneAssignments ?? []) as ZoneAssignmentRow[])[0] ?? null;

  return {
    chainId: ((companyData ?? null) as CompanyRow | null)?.chain_id ?? null,
    restaurantId: restaurantAssignment?.restaurant_id ?? null,
    zoneId: zoneAssignment?.zone_id ?? null,
  };
}

export async function loadPersonProfileByIdWithClient(
  supabase: QueryClient,
  personId: string,
): Promise<PersonProfile> {
  const { data: person, error: personError } = await supabase
    .from('persons')
    .select(
      'person_id, first_name, last_name, email, phone, identity_document, avatar_url, system_role, is_archived, access_status, agora_employee_id',
    )
    .eq('person_id', personId)
    .maybeSingle();

  if (personError && personError.code !== 'PGRST116') {
    throw new Error(`Failed to load person: ${personError.message}`);
  }
  if (!person) {
    throw new Error(`Person not found: ${personId}`);
  }

  const typedPerson = person as PersonRow;
  const accessStatus = parseAccessStatus(
    typedPerson.access_status,
    typedPerson.is_archived,
  );
  const systemRole = coerceSystemRole(typedPerson.system_role);
  const snapshot = await loadLatestOperationalSnapshot(supabase, personId);

  return {
    access_status: accessStatus,
    avatar_path: typedPerson.avatar_url ?? null,
    chain_id: snapshot.chainId,
    employee_code: Number.parseInt(typedPerson.agora_employee_id ?? '0', 10) || 0,
    full_name: formatProjectedPersonFullName(typedPerson) || '(sin nombre)',
    id: typedPerson.person_id,
    is_archived: typedPerson.is_archived,
    restaurant_id: snapshot.restaurantId,
    system_role: systemRole,
    zone_id: snapshot.zoneId,
  };
}

export async function loadPersonProfileById(personId: string): Promise<PersonProfile> {
  const supabase = createSupabaseAdminClient();
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

  const row = data as Pick<PersonRow, 'access_status' | 'is_archived'>;
  return {
    access_status: parseAccessStatus(row.access_status, row.is_archived),
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

  const name = formatProjectedPersonFullName(
    data as Pick<PersonRow, 'first_name' | 'last_name'>,
  );
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
    access_status: 'pending_activation',
    agora_employee_id: input.agoraEmployeeId ?? null,
    avatar_url: null,
    email: input.email,
    first_name: firstName,
    identity_document: input.identityDocument,
    is_archived: false,
    last_name: lastName,
    person_id: personId,
    phone: input.phone,
    system_role: input.systemRole ?? 'employee',
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
      access_status: 'archived',
      deleted_at: timestamp,
      is_archived: true,
      updated_at: timestamp,
    })
    .eq('person_id', input.personId);

  if (personError) {
    throw new Error(`Failed to archive person: ${personError.message}`);
  }
}
