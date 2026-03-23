import 'server-only';

import type { SystemRole } from '@/modules/authz';
import type { PersonProfile } from '@/modules/people';
import { createSupabaseAdminClient } from '@/shared/supabase/admin';
import { createSupabaseServerClient } from '@/shared/supabase/server';

// ─────────────────────────────────────────────────────────────
// Tipos internos — filas raw de la BD v6
// ─────────────────────────────────────────────────────────────

type PersonRow = {
  person_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  identity_document: string | null;
  avatar_url: string | null;
  system_role: SystemRole;
  is_archived: boolean;
  onboarding_status: 'draft' | 'pending_activation' | 'active' | 'suspended';
  agora_employee_id: string | null;
  chain_id: string | null;
};

type ActiveEmploymentRow = {
  restaurant_id: string;
};

type ActiveZoneScopeRow = {
  scope_id: string | null;
};

// ─────────────────────────────────────────────────────────────
// Tipos públicos de input
// ─────────────────────────────────────────────────────────────

export type CreateLegacyPersonInput = {
  email: string;
  emailConfirm?: boolean;
  fullName: string;
  phone: string;
  identityDocument: string;
  systemRole?: SystemRole;
  chainId: string;
  mustChangePassword?: boolean;
  agoraEmployeeId?: string;
};

export type UpdateLegacyPersonIdentityInput = {
  avatarPath?: string | null;
  fullName?: string;
  phone?: string;
  identityDocument?: string;
  mustChangePassword?: boolean;
  personId: string;
};

export type UpdateLegacyPersonCredentialsInput = {
  email?: string;
  password?: string;
  personId: string;
};

export type ArchiveLegacyPersonInput = {
  personId: string;
  soft?: boolean;
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────
// loadLegacyPersonProfileByIdWithClient
// Construye el PersonProfile desde persons + employment + role_scope
// Sin ninguna referencia a profiles
// ─────────────────────────────────────────────────────────────

type ServerSupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export async function loadLegacyPersonProfileByIdWithClient(
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
        'person_id, first_name, last_name, email, phone, identity_document, avatar_url, system_role, is_archived, onboarding_status, chain_id',
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

  const fullName = formatProjectedPersonFullName({
    first_name: p.first_name,
    last_name: p.last_name,
  });

  return {
    // Campos legacy que el resto del código espera
    id: p.person_id,
    employee_code: 0,              // sin equivalente en v6
    full_name: fullName || '(sin nombre)',
    role: p.system_role,
    is_active: !p.is_archived,
    is_archived: p.is_archived,
    must_change_password: p.onboarding_status === 'pending_activation',
    avatar_path: p.avatar_url ?? null,
    restaurant_id: emp?.restaurant_id ?? null,
    zone_id: zone?.scope_id ?? null,

    // Campos v6
    system_role: p.system_role,
    onboarding_status: p.onboarding_status,
  };
}

export async function loadLegacyPersonProfileById(personId: string): Promise<PersonProfile> {
  const supabase = await createSupabaseServerClient();
  return loadLegacyPersonProfileByIdWithClient(supabase, personId);
}

// ─────────────────────────────────────────────────────────────
// loadLegacyPersonAccessState
// Usada en login para verificar si el usuario puede acceder
// ─────────────────────────────────────────────────────────────

export async function loadLegacyPersonAccessState(
  personId: string,
): Promise<{ is_active: boolean; is_archived: boolean } | null> {
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .from('persons')
    .select('is_archived, onboarding_status')
    .eq('person_id', personId)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to load person access state: ${error.message}`);
  }

  if (!data) return null;

  const p = data as Pick<PersonRow, 'is_archived' | 'onboarding_status'>;
  const isArchived = p.is_archived;
  const isSuspended = p.onboarding_status === 'suspended';
  const isActive = !isArchived && !isSuspended;

  return {
    is_active: isActive,
    is_archived: isArchived,
  };
}

// ─────────────────────────────────────────────────────────────
// loadProjectedPersonDisplayName
// ─────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────
// createLegacyPerson
// Flujo v6: auth.user + persons en una sola operación atómica
// Si persons falla → elimina el auth.user para no dejar huérfanos
// ─────────────────────────────────────────────────────────────

export async function createLegacyPerson(input: CreateLegacyPersonInput): Promise<string> {
  const admin = createSupabaseAdminClient();

  // 1. Crear auth.user sin password → Supabase enviará email de activación
  const { data, error } = await admin.auth.admin.createUser({
    email: input.email,
    email_confirm: input.emailConfirm ?? false, // false = envía email de activación
  });

  if (error || !data.user) {
    throw new Error(`Failed to create auth user: ${error?.message ?? 'unknown error'}`);
  }

  const personId = data.user.id;
  const { firstName, lastName } = splitFullName(input.fullName);

  // 2. Crear person en v6 con onboarding_status = pending_activation
  const { error: personError } = await admin.from('persons').insert({
    person_id: personId,
    chain_id: input.chainId,
    first_name: firstName,
    last_name: lastName,
    email: input.email,
    phone: input.phone,
    identity_document: input.identityDocument,
    system_role: input.systemRole ?? 'employee',
    onboarding_status: 'pending_activation',
    is_archived: false,
    agora_employee_id: input.agoraEmployeeId ?? null,
  });

  if (personError) {
    // Rollback: eliminar el auth.user para no dejar huérfano
    await admin.auth.admin.deleteUser(personId, false);
    throw new Error(`Failed to create person: ${personError.message}`);
  }

  return personId;
}

// ─────────────────────────────────────────────────────────────
// updateLegacyPersonIdentity
// ─────────────────────────────────────────────────────────────

export async function updateLegacyPersonIdentity(
  input: UpdateLegacyPersonIdentityInput,
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
  if (input.mustChangePassword !== undefined) {
    // En v6: must_change_password se mapea a onboarding_status
    patch.onboarding_status = input.mustChangePassword ? 'pending_activation' : 'active';
  }

  if (Object.keys(patch).length <= 1) return; // solo updated_at, nada que hacer

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from('persons')
    .update(patch)
    .eq('person_id', input.personId);

  if (error) {
    throw new Error(`Failed to update person identity: ${error.message}`);
  }
}

// ─────────────────────────────────────────────────────────────
// updateLegacyPersonCredentials
// ─────────────────────────────────────────────────────────────

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

  // Sincronizar email en persons si cambió
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

// ─────────────────────────────────────────────────────────────
// archiveLegacyPerson
// ─────────────────────────────────────────────────────────────

export async function archiveLegacyPerson(input: ArchiveLegacyPersonInput): Promise<void> {
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
      onboarding_status: 'suspended',
      deleted_at: timestamp,
      updated_at: timestamp,
    })
    .eq('person_id', input.personId);

  if (personError) {
    throw new Error(`Failed to archive person: ${personError.message}`);
  }
}

// ─────────────────────────────────────────────────────────────
// mapSystemRoleToLegacyProfileRole
// Compatibilidad con código que usa el campo role del PersonProfile
// ─────────────────────────────────────────────────────────────

export function mapSystemRoleToLegacyProfileRole(systemRole: SystemRole): PersonProfile['role'] {
  return systemRole;
}