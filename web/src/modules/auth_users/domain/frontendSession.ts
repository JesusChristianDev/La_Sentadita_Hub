import type { AccessStatus } from '@/modules/people';

import type { BackendScopeType } from './backendSession';

export type FrontendPageMode =
  | 'forbidden'
  | 'context_required'
  | 'global_overview'
  | 'self_service'
  | 'restaurant_workspace'
  | 'zone_workspace'
  | 'team_workspace';

export type RestaurantScopedModuleMode = Extract<
  FrontendPageMode,
  'forbidden' | 'context_required' | 'restaurant_workspace'
>;

export type RequestsPageMode = Extract<
  FrontendPageMode,
  'forbidden' | 'context_required' | 'self_service' | 'team_workspace'
>;

export type FrontendCapabilities = {
  context: {
    canSelectRestaurant: boolean;
    canSelectScope: boolean;
    hasEffectiveRestaurant: boolean;
    isChainScope: boolean;
    isCompanyScope: boolean;
    isGlobalScope: boolean;
    isRestaurantScope: boolean;
    isSelfScope: boolean;
    isZoneScope: boolean;
  };
  employees: {
    create: boolean;
    manage: boolean;
    view: boolean;
  };
  navigation: {
    dashboard: boolean;
    employees: boolean;
    incidents: boolean;
    documents: boolean;
    procurement: boolean;
    notifications: boolean;
    me: boolean;
    requests: boolean;
    schedules: boolean;
    tasks: boolean;
  };
  incidents: {
    manage: boolean;
    view: boolean;
  };
  documents: {
    create: boolean;
    manage: boolean;
    view: boolean;
  };
  procurement: {
    manage: boolean;
    view: boolean;
  };
  notifications: {
    view: boolean;
  };
  requests: {
    manage: boolean;
    view: boolean;
  };
  schedules: {
    editDraft: boolean;
    editEmployee: boolean;
    manageTemplates: boolean;
    publish: boolean;
    review: boolean;
    view: boolean;
  };
  tasks: {
    manage: boolean;
    view: boolean;
  };
};

export type FrontendScopeOption = {
  authorityTier: string | null;
  isDerived: boolean;
  label: string;
  groupLabel?: string | null;
  companyId?: string | null;
  chainId?: string | null;
  scopeId: string | null;
  scopeType: BackendScopeType;
};

export type FrontendVisibleRestaurant = {
  chainId: string | null;
  companyId: string;
  id: string;
  isActive: boolean;
  name: string;
};

export type FrontendSessionView = {
  activeScope: {
    label: string;
    scopeId: string | null;
    scopeType: BackendScopeType;
  };
  availableScopes: FrontendScopeOption[];
  capabilities: FrontendCapabilities;
  effectiveRestaurantId: string | null;
  person: {
    accessStatus: AccessStatus;
    avatarUrl: string | null;
    fullName: string;
    id: string;
    systemRole: 'admin' | 'owner' | 'office' | 'manager' | 'area_lead' | 'employee';
  };
  visibleRestaurants: FrontendVisibleRestaurant[];
};
