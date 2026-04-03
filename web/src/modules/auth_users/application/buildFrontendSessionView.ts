import { type AuthzAction, can } from '@/shared/authz';

import type {
  FrontendCapabilities,
  FrontendSessionView,
} from '../domain/frontendSession';
import type { CurrentSession } from './getCurrentUserContext';
import { resolveScopeUiState } from './resolveScopeUiState';

const ACTIONS = {
  employeesCreate: 'employees.create',
  employeesManage: 'employees.manage',
  employeesView: 'employees.view',
  requestsManage: 'requests.manage',
  requestsView: 'requests.view',
  restaurantContextSelect: 'restaurant_context.select',
  scheduleEditDraft: 'schedule.edit_draft',
  scheduleEditEmployee: 'schedule.edit_employee',
  scheduleManageTemplates: 'schedule.manage_templates',
  schedulePublish: 'schedule.publish',
  scheduleReview: 'schedule.review',
  scheduleView: 'schedule.view',
  tasksManage: 'tasks.manage',
  tasksView: 'tasks.view',
} satisfies Record<string, AuthzAction>;

function resolveActiveScopeLabel(ctx: CurrentSession): string {
  const { activeScope, availableScopes } = ctx.backendSession;
  const currentScope =
    availableScopes.find(
      (scope) =>
        scope.scopeId === activeScope.scopeId && scope.scopeType === activeScope.scopeType,
    ) ?? null;

  if (currentScope?.label) {
    return currentScope.label;
  }

  if (activeScope.scopeType === 'restaurant') {
    const restaurant = ctx.backendSession.visibleRestaurants.find(
      (item) => item.id === activeScope.scopeId,
    );
    return restaurant?.name ?? 'Sucursal activa';
  }

  if (activeScope.scopeType === 'organization') {
    return 'Vista global';
  }

  return 'Contexto activo';
}

function buildCapabilities(ctx: CurrentSession): FrontendCapabilities {
  const canSelectRestaurant = can(ctx.requestContext, ACTIONS.restaurantContextSelect);
  const employeesView = can(ctx.requestContext, ACTIONS.employeesView);
  const incidentsView = can(ctx.requestContext, 'incidents.view');
  const documentsView = can(ctx.requestContext, 'documents.view');
  const procurementView = can(ctx.requestContext, 'procurement.view');
  const notificationsView = can(ctx.requestContext, 'notifications.view');
  const schedulesView = can(ctx.requestContext, ACTIONS.scheduleView);
  const tasksView = can(ctx.requestContext, ACTIONS.tasksView);
  const requestsView = can(ctx.requestContext, ACTIONS.requestsView);
  const scopeUiState = resolveScopeUiState(ctx.backendSession.activeScope.scopeType);

  return {
    context: {
      canSelectRestaurant,
      canSelectScope: ctx.backendSession.availableScopes.length > 1,
      hasEffectiveRestaurant: Boolean(ctx.backendSession.effectiveRestaurantId),
      isChainScope: scopeUiState.isChainScope,
      isCompanyScope: scopeUiState.isCompanyScope,
      isGlobalScope: scopeUiState.isGlobalScope,
      isRestaurantScope: scopeUiState.isRestaurantScope,
      isSelfScope: scopeUiState.isSelfScope,
      isZoneScope: scopeUiState.isZoneScope,
    },
    employees: {
      create: can(ctx.requestContext, ACTIONS.employeesCreate),
      manage: can(ctx.requestContext, ACTIONS.employeesManage),
      view: employeesView,
    },
    incidents: {
      manage: can(ctx.requestContext, 'incidents.manage'),
      view: incidentsView,
    },
    documents: {
      create: can(ctx.requestContext, 'documents.create'),
      manage: can(ctx.requestContext, 'documents.manage'),
      view: documentsView,
    },
    navigation: {
      dashboard: true,
      employees: employeesView,
      documents: documentsView,
      incidents: incidentsView,
      notifications: notificationsView,
      procurement: procurementView,
      me: true,
      requests: requestsView,
      schedules: schedulesView,
      tasks: tasksView,
    },
    notifications: {
      view: notificationsView,
    },
    procurement: {
      manage: can(ctx.requestContext, 'procurement.manage'),
      view: procurementView,
    },
    requests: {
      manage: can(ctx.requestContext, ACTIONS.requestsManage),
      view: requestsView,
    },
    schedules: {
      editDraft: can(ctx.requestContext, ACTIONS.scheduleEditDraft),
      editEmployee: can(ctx.requestContext, ACTIONS.scheduleEditEmployee),
      manageTemplates: can(ctx.requestContext, ACTIONS.scheduleManageTemplates),
      publish: can(ctx.requestContext, ACTIONS.schedulePublish),
      review: can(ctx.requestContext, ACTIONS.scheduleReview),
      view: schedulesView,
    },
    tasks: {
      manage: can(ctx.requestContext, ACTIONS.tasksManage),
      view: tasksView,
    },
  };
}

export function buildFrontendSessionView(ctx: CurrentSession): FrontendSessionView {
  const capabilities = buildCapabilities(ctx);

  return {
    activeScope: {
      label: resolveActiveScopeLabel(ctx),
      scopeId: ctx.backendSession.activeScope.scopeId,
      scopeType: ctx.backendSession.activeScope.scopeType,
    },
    availableScopes: ctx.backendSession.availableScopes,
    capabilities,
    effectiveRestaurantId: ctx.backendSession.effectiveRestaurantId,
    person: {
      accessStatus: ctx.backendSession.person.accessStatus,
      avatarUrl: ctx.backendSession.person.avatarUrl,
      fullName: ctx.backendSession.person.fullName,
      id: ctx.backendSession.person.id,
      systemRole: ctx.backendSession.person.systemRole,
    },
    visibleRestaurants: ctx.backendSession.visibleRestaurants.map((restaurant) => ({
      chainId: restaurant.chainId,
      companyId: restaurant.companyId,
      id: restaurant.id,
      isActive: restaurant.isActive,
      name: restaurant.name,
    })),
  };
}
