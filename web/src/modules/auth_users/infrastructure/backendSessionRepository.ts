import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { AccessStatus, PersonProfile } from '@/modules/people';
import { coerceSystemRole } from '@/shared/authz';

import {
  readLegacyActiveRestaurantId,
  readStoredActiveScope,
} from '../application/activeScopeCookies';
import type {
  BackendActiveScope,
  BackendAvailableScope,
  BackendEmployment,
  BackendPerson,
  BackendRestaurantAssignment,
  BackendRoleScopeAssignment,
  BackendScopeType,
  BackendSession,
  BackendVisibleRestaurant,
  BackendZoneAssignment,
} from '../domain/backendSession';

type PersonRow = {
  access_status: AccessStatus | null;
  agora_employee_id: string | null;
  avatar_url: string | null;
  email: string | null;
  first_name: string;
  identity_document: string | null;
  is_archived: boolean;
  last_name: string;
  person_id: string;
  phone: string | null;
  system_role: string;
};

type EmploymentRow = {
  company_id: string;
  contract_type: string | null;
  employment_id: string;
  is_archived: boolean;
  job_title: string | null;
  person_id: string;
  requires_schedule: boolean | null;
  valid_from: string;
  valid_to: string | null;
};

type CompanyRow = {
  chain_id: string | null;
  company_id: string;
  name: string;
  organization_id: string;
};

type ChainRow = {
  chain_id: string;
  name: string;
};

type RestaurantRow = {
  company_id: string;
  id: string;
  is_active: boolean;
  name: string;
};

type RestaurantAssignmentRow = {
  assignment_id: string;
  created_at: string;
  employment_id: string;
  restaurant_id: string;
  transfer_reason: string | null;
  valid_from: string;
  valid_to: string | null;
};

type ZoneRow = {
  id: string;
  name: string;
  restaurant_id: string;
};

type ZoneAssignmentRow = {
  assignment_id: string;
  created_at: string;
  employment_id: string;
  valid_from: string;
  valid_to: string | null;
  zone_id: string;
};

type RoleScopeRow = {
  assignment_id: string;
  authority_tier: string | null;
  scope_id: string;
  scope_type: Exclude<BackendScopeType, 'self'>;
  valid_from: string;
  valid_to: string | null;
};

function formatFullName(firstName: string, lastName: string): string {
  return [firstName, lastName].filter(Boolean).join(' ').trim();
}

function parseAccessStatus(
  accessStatus: AccessStatus | null,
  isArchived: boolean,
): AccessStatus {
  if (accessStatus) return accessStatus;
  return isArchived ? 'archived' : 'active';
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function isCurrentRange(validFrom: string, validTo: string | null, today: string): boolean {
  return validFrom <= today && (validTo === null || validTo >= today);
}

function isFutureRange(validFrom: string, today: string): boolean {
  return validFrom > today;
}

function dedupeScopes(scopes: BackendAvailableScope[]): BackendAvailableScope[] {
  const seen = new Set<string>();
  const result: BackendAvailableScope[] = [];

  for (const scope of scopes) {
    const key = `${scope.scopeType}:${scope.scopeId ?? 'null'}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(scope);
  }

  return result;
}

function buildScopeLabel(params: {
  chainName?: string | null;
  companyName?: string | null;
  restaurantName?: string | null;
  scopeType: BackendScopeType;
  zoneName?: string | null;
}): string {
  switch (params.scopeType) {
    case 'organization':
      return 'Organizacion';
    case 'chain':
      return params.chainName ?? 'Cadena';
    case 'company':
      return params.companyName ?? 'Empresa';
    case 'restaurant':
      return params.restaurantName ?? 'Restaurante';
    case 'zone':
      return params.zoneName ?? 'Zona';
    case 'self':
      return 'Mi perfil';
  }
}

function scopeContainsRestaurant(
  scope: RoleScopeRow,
  restaurant: BackendVisibleRestaurant,
): boolean {
  switch (scope.scope_type) {
    case 'organization':
      return restaurant.organizationId === scope.scope_id;
    case 'chain':
      return restaurant.chainId === scope.scope_id;
    case 'company':
      return restaurant.companyId === scope.scope_id;
    case 'restaurant':
      return restaurant.id === scope.scope_id;
    case 'zone':
      return false;
  }
}

function resolveProfileFromSession(session: BackendSession): PersonProfile {
  const currentRestaurantAssignment =
    session.currentEmployment?.restaurantAssignments.find((assignment) => assignment.isCurrent) ??
    null;
  const currentZoneAssignment =
    session.currentEmployment?.zoneAssignments.find((assignment) => assignment.isCurrent) ?? null;
  const effectiveRestaurant =
    session.visibleRestaurants.find(
      (restaurant) => restaurant.id === session.effectiveRestaurantId,
    ) ?? null;

  const currentRestaurant =
    currentRestaurantAssignment
      ? session.visibleRestaurants.find(
          (restaurant) => restaurant.id === currentRestaurantAssignment.restaurantId,
        ) ?? null
      : null;

  return {
    access_status: session.person.accessStatus,
    avatar_path: session.person.avatarUrl,
    chain_id:
      currentRestaurant?.chainId ??
      session.currentEmployment?.chainId ??
      effectiveRestaurant?.chainId ??
      null,
    employee_code: 0,
    full_name: session.person.fullName || '(sin nombre)',
    id: session.person.id,
    is_archived: session.person.isArchived,
    restaurant_id: currentRestaurantAssignment?.restaurantId ?? null,

    system_role: session.person.systemRole,
    zone_id: currentZoneAssignment?.zoneId ?? null,
  };
}

async function getAuthenticatedUserId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    throw new Error(`Failed to load authenticated user: ${error.message}`);
  }

  return data.user?.id ?? null;
}

export async function loadBackendSession(): Promise<BackendSession | null> {
  const userId = await getAuthenticatedUserId();
  if (!userId) return null;

  const admin = createSupabaseAdminClient();
  const today = todayIsoDate();

  const [
    { data: personData, error: personError },
    { data: employmentData, error: employmentError },
    { data: roleScopeData, error: roleScopeError },
    { data: companyData, error: companyError },
    { data: chainData, error: chainError },
    { data: restaurantData, error: restaurantError },
  ] = await Promise.all([
    admin
      .from('persons')
      .select(
        'person_id, first_name, last_name, email, phone, identity_document, avatar_url, system_role, is_archived, access_status, agora_employee_id',
      )
      .eq('person_id', userId)
      .maybeSingle(),
    admin
      .from('employment_relationships')
      .select(
        'employment_id, person_id, company_id, job_title, contract_type, requires_schedule, valid_from, valid_to, is_archived',
      )
      .eq('person_id', userId)
      .eq('is_archived', false)
      .order('valid_from', { ascending: false }),
    admin
      .from('role_scope_assignments')
      .select(
        'assignment_id, scope_type, scope_id, valid_from, valid_to, authority_tier',
      )
      .eq('person_id', userId)
      .order('valid_from', { ascending: false }),
    admin
      .from('companies')
      .select('company_id, name, organization_id, chain_id')
      .eq('is_archived', false),
    admin.from('chains').select('chain_id, name').eq('is_archived', false),
    admin
      .from('restaurants')
      .select('id, name, is_active, company_id')
      .eq('is_archived', false),
  ]);

  if (personError) throw new Error(`Failed to load person projection: ${personError.message}`);
  if (employmentError) {
    throw new Error(`Failed to load employment projection: ${employmentError.message}`);
  }
  if (roleScopeError) {
    throw new Error(`Failed to load role scope projection: ${roleScopeError.message}`);
  }
  if (companyError) throw new Error(`Failed to load companies: ${companyError.message}`);
  if (chainError) throw new Error(`Failed to load chains: ${chainError.message}`);
  if (restaurantError) throw new Error(`Failed to load restaurants: ${restaurantError.message}`);
  if (!personData) return null;

  const personRow = personData as PersonRow;
  const employments = ((employmentData ?? []) as EmploymentRow[]).filter(
    (employment) => !employment.is_archived,
  );
  const roleScopeRows = (roleScopeData ?? []) as RoleScopeRow[];
  const companies = (companyData ?? []) as CompanyRow[];
  const chains = (chainData ?? []) as ChainRow[];
  const restaurants = (restaurantData ?? []) as RestaurantRow[];

  const employmentIds = employments.map((employment) => employment.employment_id);
  const [{ data: restaurantAssignmentData, error: restaurantAssignmentError }, { data: zoneData, error: zoneError }] =
    await Promise.all([
      employmentIds.length === 0
        ? Promise.resolve({ data: [], error: null })
        : admin
            .from('employment_restaurant_assignments')
            .select(
              'assignment_id, employment_id, restaurant_id, valid_from, valid_to, transfer_reason, created_at',
            )
            .in('employment_id', employmentIds)
            .order('valid_from', { ascending: false }),
      employmentIds.length === 0
        ? Promise.resolve({ data: [], error: null })
        : admin
            .from('employment_zone_assignments')
            .select('assignment_id, employment_id, zone_id, valid_from, valid_to, created_at')
            .in('employment_id', employmentIds)
            .order('valid_from', { ascending: false }),
    ]);

  if (restaurantAssignmentError) {
    throw new Error(
      `Failed to load restaurant assignments: ${restaurantAssignmentError.message}`,
    );
  }
  if (zoneError) throw new Error(`Failed to load zone assignments: ${zoneError.message}`);

  const restaurantAssignmentRows = (restaurantAssignmentData ?? []) as RestaurantAssignmentRow[];
  const zoneAssignmentRows = (zoneData ?? []) as ZoneAssignmentRow[];
  const zoneIds = zoneAssignmentRows.map((assignment) => assignment.zone_id);

  const { data: zoneRowsData, error: zoneRowsError } =
    zoneIds.length === 0
      ? { data: [], error: null }
      : await admin
          .from('restaurant_zones')
          .select('id, restaurant_id, name')
          .in('id', zoneIds);

  if (zoneRowsError) {
    throw new Error(`Failed to load zone catalog: ${zoneRowsError.message}`);
  }

  const zoneRows = (zoneRowsData ?? []) as ZoneRow[];
  const companyById = new Map(companies.map((company) => [company.company_id, company]));
  const chainById = new Map(chains.map((chain) => [chain.chain_id, chain]));
  const restaurantById = new Map(restaurants.map((restaurant) => [restaurant.id, restaurant]));
  const zoneById = new Map(zoneRows.map((zone) => [zone.id, zone]));

  const backendPerson: BackendPerson = {
    accessStatus: parseAccessStatus(personRow.access_status, personRow.is_archived),
    agoraEmployeeId: personRow.agora_employee_id,
    avatarUrl: personRow.avatar_url,
    email: personRow.email,
    firstName: personRow.first_name,
    fullName: formatFullName(personRow.first_name, personRow.last_name),
    id: personRow.person_id,
    identityDocument: personRow.identity_document,
    isArchived: personRow.is_archived,
    lastName: personRow.last_name,
    phone: personRow.phone,
    systemRole: coerceSystemRole(personRow.system_role),
  };

  const backendRestaurantAssignmentsByEmploymentId = new Map<
    string,
    BackendRestaurantAssignment[]
  >();

  for (const assignment of restaurantAssignmentRows) {
    const restaurant = restaurantById.get(assignment.restaurant_id) ?? null;
    const company = restaurant ? companyById.get(restaurant.company_id) ?? null : null;

    const mapped: BackendRestaurantAssignment = {
      assignmentId: assignment.assignment_id,
      companyId: company?.company_id ?? null,
      companyName: company?.name ?? null,
      employmentId: assignment.employment_id,
      isCurrent: isCurrentRange(assignment.valid_from, assignment.valid_to, today),
      isFuture: isFutureRange(assignment.valid_from, today),
      organizationId: company?.organization_id ?? null,
      restaurantId: assignment.restaurant_id,
      restaurantName: restaurant?.name ?? null,
      transferReason: assignment.transfer_reason,
      validFrom: assignment.valid_from,
      validTo: assignment.valid_to,
    };

    const current = backendRestaurantAssignmentsByEmploymentId.get(assignment.employment_id) ?? [];
    current.push(mapped);
    backendRestaurantAssignmentsByEmploymentId.set(assignment.employment_id, current);
  }

  const backendZoneAssignmentsByEmploymentId = new Map<string, BackendZoneAssignment[]>();

  for (const assignment of zoneAssignmentRows) {
    const zone = zoneById.get(assignment.zone_id) ?? null;
    const restaurant = zone ? restaurantById.get(zone.restaurant_id) ?? null : null;

    const mapped: BackendZoneAssignment = {
      assignmentId: assignment.assignment_id,
      employmentId: assignment.employment_id,
      isCurrent: isCurrentRange(assignment.valid_from, assignment.valid_to, today),
      isFuture: isFutureRange(assignment.valid_from, today),
      restaurantId: zone?.restaurant_id ?? null,
      restaurantName: restaurant?.name ?? null,
      validFrom: assignment.valid_from,
      validTo: assignment.valid_to,
      zoneId: assignment.zone_id,
      zoneName: zone?.name ?? null,
    };

    const current = backendZoneAssignmentsByEmploymentId.get(assignment.employment_id) ?? [];
    current.push(mapped);
    backendZoneAssignmentsByEmploymentId.set(assignment.employment_id, current);
  }

  const backendEmployments: BackendEmployment[] = employments.map((employment) => {
    const company = companyById.get(employment.company_id) ?? null;
    const chain = company?.chain_id ? chainById.get(company.chain_id) ?? null : null;

    return {
      chainId: company?.chain_id ?? null,
      chainName: chain?.name ?? null,
      companyId: employment.company_id,
      companyName: company?.name ?? null,
      contractType: employment.contract_type,
      employmentId: employment.employment_id,
      isCurrent: isCurrentRange(employment.valid_from, employment.valid_to, today),
      jobTitle: employment.job_title,
      organizationId: company?.organization_id ?? null,
      requiresSchedule: employment.requires_schedule ?? false,
      restaurantAssignments:
        backendRestaurantAssignmentsByEmploymentId.get(employment.employment_id) ?? [],
      validFrom: employment.valid_from,
      validTo: employment.valid_to,
      zoneAssignments: backendZoneAssignmentsByEmploymentId.get(employment.employment_id) ?? [],
    };
  });

  const currentEmployment =
    backendEmployments.find((employment) => employment.isCurrent) ?? backendEmployments[0] ?? null;

  const currentRoleScopes = roleScopeRows.filter((scope) =>
    isCurrentRange(scope.valid_from, scope.valid_to, today),
  );

  const allVisibleRestaurants = restaurants.reduce<BackendVisibleRestaurant[]>(
    (acc, restaurant) => {
      const company = companyById.get(restaurant.company_id);
      if (!company) return acc;
      const chain = company.chain_id ? chainById.get(company.chain_id) ?? null : null;

      acc.push({
        chainId: company.chain_id,
        chainName: chain?.name ?? null,
        companyId: company.company_id,
        companyName: company.name,
        id: restaurant.id,
        isActive: restaurant.is_active,
        name: restaurant.name,
        organizationId: company.organization_id,
      });

      return acc;
    },
    [],
  );

  const currentOperationalRestaurantIds = new Set(
    currentEmployment?.restaurantAssignments
      .filter((assignment) => assignment.isCurrent)
      .map((assignment) => assignment.restaurantId) ?? [],
  );

  const visibleRestaurants =
    backendPerson.systemRole === 'admin'
      ? allVisibleRestaurants
      : backendPerson.systemRole === 'owner' || backendPerson.systemRole === 'office'
        ? allVisibleRestaurants.filter((restaurant) =>
            currentRoleScopes.some((scope) => scopeContainsRestaurant(scope, restaurant)),
          )
        : backendPerson.systemRole === 'manager'
          ? allVisibleRestaurants.filter(
              (restaurant) =>
                currentRoleScopes.some((scope) => scopeContainsRestaurant(scope, restaurant)) ||
                currentOperationalRestaurantIds.has(restaurant.id),
            )
          : allVisibleRestaurants.filter((restaurant) =>
              currentOperationalRestaurantIds.has(restaurant.id),
            );

  const backendRoleScopes: BackendRoleScopeAssignment[] = roleScopeRows.map((scope) => {
    const company = companyById.get(scope.scope_id) ?? null;
    const chain = chainById.get(scope.scope_id) ?? null;
    const restaurant = restaurantById.get(scope.scope_id) ?? null;
    const zone = zoneById.get(scope.scope_id) ?? null;

    return {
      assignmentId: scope.assignment_id,
      authorityTier: scope.authority_tier,
      isCurrent: isCurrentRange(scope.valid_from, scope.valid_to, today),
      isFuture: isFutureRange(scope.valid_from, today),
      label: buildScopeLabel({
        chainName: chain?.name ?? null,
        companyName: company?.name ?? null,
        restaurantName: restaurant?.name ?? null,
        scopeType: scope.scope_type,
        zoneName: zone?.name ?? null,
      }),
      scopeId: scope.scope_id,
      scopeType: scope.scope_type,
      validFrom: scope.valid_from,
      validTo: scope.valid_to,
    };
  });

  const isHighLevelManagement = ['admin', 'owner', 'office'].includes(backendPerson.systemRole);

  // Derived scopes:
  // - Si el usuario puede ver ciertos restaurantes, entonces también puede seleccionar
  //   sus ramas jerarquicas (company / chain / organization) para cambiar el "scope" de la UI.
  const derivedCompanyScopes: BackendAvailableScope[] = [];
  const derivedChainScopes: BackendAvailableScope[] = [];
  const derivedOrganizationScopes: BackendAvailableScope[] = [];

  const companiesById = new Map<string, { name: string; chainId: string | null; chainName: string | null }>();
  const chainsById = new Map<string, { name: string | null }>();
  const organizationsById = new Map<string, { name: string }>();

  for (const restaurant of visibleRestaurants) {
    companiesById.set(restaurant.companyId, {
      name: restaurant.companyName ?? 'Empresa',
      chainId: restaurant.chainId,
      chainName: restaurant.chainName,
    });

    if (restaurant.chainId && restaurant.chainId !== null) {
      chainsById.set(restaurant.chainId, { name: restaurant.chainName });
    }

    if (restaurant.organizationId && restaurant.organizationId !== null) {
      // No tenemos nombre explícito de organization aquí; usamos etiqueta fija.
      organizationsById.set(restaurant.organizationId, { name: 'Organizacion' });
    }
  }

  for (const [companyId, data] of companiesById.entries()) {
    derivedCompanyScopes.push({
      authorityTier: null,
      isDerived: true,
      label: data.name,
      scopeId: companyId,
      scopeType: 'company',
      groupLabel: data.name,
      chainId: data.chainId,
    });
  }

  for (const [chainId, data] of chainsById.entries()) {
    derivedChainScopes.push({
      authorityTier: null,
      isDerived: true,
      label: data.name ?? 'Cadena',
      scopeId: chainId,
      scopeType: 'chain',
    });
  }

  for (const [organizationId, data] of organizationsById.entries()) {
    derivedOrganizationScopes.push({
      authorityTier: null,
      isDerived: true,
      label: data.name,
      scopeId: organizationId,
      scopeType: 'organization',
    });
  }

  const rawAvailableScopes: BackendAvailableScope[] = [
    {
      authorityTier: null,
      isDerived: true,
      label: 'Mi perfil',
      scopeId: backendPerson.id,
      scopeType: 'self',
    },
    ...backendRoleScopes
      .filter((scope) => scope.isCurrent)
      .map<BackendAvailableScope>((scope) => ({
        authorityTier: scope.authorityTier,
        isDerived: false,
        label: scope.label,
        scopeId: scope.scopeId,
        scopeType: scope.scopeType,
      })),
    ...derivedOrganizationScopes,
    ...derivedChainScopes,
    ...derivedCompanyScopes,
    ...visibleRestaurants.map<BackendAvailableScope>((restaurant) => ({
      authorityTier: null,
      isDerived: true,
      label: restaurant.name,
      groupLabel: restaurant.companyName ?? 'Empresa',
      companyId: restaurant.companyId,
      chainId: restaurant.chainId,
      scopeId: restaurant.id,
      scopeType: 'restaurant',
    })),
    ...(currentEmployment?.zoneAssignments
      .filter((assignment) => assignment.isCurrent)
      .map<BackendAvailableScope>((assignment) => ({
        authorityTier: null,
        isDerived: true,
        label: assignment.zoneName ?? 'Zona',
        scopeId: assignment.zoneId,
        scopeType: 'zone',
      })) ?? []),
  ];

  // Logic: Remove 'self' if the user has management scopes, it's redundant/confusing.
  // Unless it's a pure employee, who ONLY has self.
  const refinedAvailableScopes = isHighLevelManagement
    ? rawAvailableScopes.filter((s) => s.scopeType !== 'self')
    : rawAvailableScopes;

  const typeOrder: Record<BackendScopeType, number> = {
    organization: 0,
    chain: 1,
    company: 2,
    restaurant: 3,
    zone: 4,
    self: 5,
  };

  const availableScopes = dedupeScopes(refinedAvailableScopes).sort((a, b) => {
    const orderA = typeOrder[a.scopeType] ?? 99;
    const orderB = typeOrder[b.scopeType] ?? 99;
    if (orderA !== orderB) return orderA - orderB;
    return (a.label || '').localeCompare(b.label || '');
  });

  const storedActiveScope = await readStoredActiveScope();
  const legacyActiveRestaurantId = await readLegacyActiveRestaurantId();

  const isAvailableScope = (scope: BackendActiveScope | null): scope is BackendActiveScope =>
    Boolean(
      scope &&
        availableScopes.some(
          (candidate) =>
            candidate.scopeType === scope.scopeType && candidate.scopeId === scope.scopeId,
        ),
    );

  const defaultActiveScope =
    isAvailableScope(storedActiveScope)
      ? storedActiveScope
      : legacyActiveRestaurantId &&
          availableScopes.some(
            (scope) => scope.scopeType === 'restaurant' && scope.scopeId === legacyActiveRestaurantId,
          )
        ? {
            scopeId: legacyActiveRestaurantId,
            scopeType: 'restaurant' as const,
          }
        : backendPerson.systemRole === 'admin' ||
            backendPerson.systemRole === 'owner' ||
            backendPerson.systemRole === 'office'
          ? (availableScopes.find(
              (scope) => scope.scopeType !== 'restaurant' && scope.scopeType !== 'self',
            ) ??
              availableScopes.find((scope) => scope.scopeType === 'self') ?? {
                scopeId: backendPerson.id,
                scopeType: 'self' as const,
              })
          : (availableScopes.find((scope) => scope.scopeType === 'zone') ??
              availableScopes.find((scope) => scope.scopeType === 'restaurant') ??
              availableScopes.find((scope) => scope.scopeType === 'self') ?? {
                scopeId: backendPerson.id,
                scopeType: 'self' as const,
              });

  const activeScope: BackendActiveScope = {
    scopeId: defaultActiveScope.scopeId,
    scopeType: defaultActiveScope.scopeType,
  };

  const effectiveRestaurantId =
    activeScope.scopeType === 'restaurant'
      ? activeScope.scopeId
      : activeScope.scopeType === 'zone'
        ? currentEmployment?.zoneAssignments.find(
            (assignment) => assignment.isCurrent && assignment.zoneId === activeScope.scopeId,
          )?.restaurantId ?? null
        : null;

  return {
    activeScope,
    availableScopes,
    currentEmployment,
    effectiveRestaurantId,
    employments: backendEmployments,
    generatedAt: new Date().toISOString(),
    person: backendPerson,
    roleScopes: backendRoleScopes,
    userId,
    visibleRestaurants,
  };
}

export function projectPersonProfileFromBackendSession(
  session: BackendSession,
): PersonProfile {
  return resolveProfileFromSession(session);
}
