import type { AccessStatus } from '@/modules/people';

export type BackendScopeType =
  | 'organization'
  | 'chain'
  | 'company'
  | 'restaurant'
  | 'zone'
  | 'self';

export type BackendPerson = {
  accessStatus: AccessStatus;
  agoraEmployeeId: string | null;
  avatarUrl: string | null;
  email: string | null;
  firstName: string;
  fullName: string;
  id: string;
  identityDocument: string | null;
  isArchived: boolean;
  lastName: string;
  phone: string | null;
  systemRole: 'admin' | 'owner' | 'office' | 'manager' | 'area_lead' | 'employee';
};

export type BackendRoleScopeAssignment = {
  assignmentId: string;
  authorityTier: string | null;
  isCurrent: boolean;
  isFuture: boolean;
  label: string;
  scopeId: string;
  scopeType: Exclude<BackendScopeType, 'self'>;
  validFrom: string;
  validTo: string | null;
};

export type BackendRestaurantAssignment = {
  assignmentId: string;
  companyId: string | null;
  companyName: string | null;
  employmentId: string;
  isCurrent: boolean;
  isFuture: boolean;
  organizationId: string | null;
  restaurantId: string;
  restaurantName: string | null;
  transferReason: string | null;
  validFrom: string;
  validTo: string | null;
};

export type BackendZoneAssignment = {
  assignmentId: string;
  employmentId: string;
  isCurrent: boolean;
  isFuture: boolean;
  restaurantId: string | null;
  restaurantName: string | null;
  validFrom: string;
  validTo: string | null;
  zoneId: string;
  zoneName: string | null;
};

export type BackendEmployment = {
  chainId: string | null;
  chainName: string | null;
  companyId: string;
  companyName: string | null;
  contractType: string | null;
  employmentId: string;
  isCurrent: boolean;
  jobTitle: string | null;
  organizationId: string | null;
  requiresSchedule: boolean;
  restaurantAssignments: BackendRestaurantAssignment[];
  validFrom: string;
  validTo: string | null;
  zoneAssignments: BackendZoneAssignment[];
};

export type BackendVisibleRestaurant = {
  chainId: string | null;
  chainName: string | null;
  companyId: string;
  companyName: string | null;
  id: string;
  isActive: boolean;
  name: string;
  organizationId: string | null;
};

export type BackendAvailableScope = {
  authorityTier: string | null;
  isDerived: boolean;
  label: string;
  scopeId: string | null;
  scopeType: BackendScopeType;
};

export type BackendActiveScope = {
  scopeId: string | null;
  scopeType: BackendScopeType;
};

export type BackendSession = {
  activeScope: BackendActiveScope;
  availableScopes: BackendAvailableScope[];
  currentEmployment: BackendEmployment | null;
  effectiveRestaurantId: string | null;
  employments: BackendEmployment[];
  generatedAt: string;
  person: BackendPerson;
  roleScopes: BackendRoleScopeAssignment[];
  userId: string;
  visibleRestaurants: BackendVisibleRestaurant[];
};
