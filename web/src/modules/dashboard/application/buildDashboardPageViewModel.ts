import type { FrontendPageMode, FrontendSessionView } from '@/modules/auth_users';

export type DashboardShortcut = {
  description: string;
  href: string;
  label: string;
};

export type DashboardPageViewModel = {
  hero: {
    activeScopeLabel: string;
    canSelectScope: boolean;
    isGlobalScope: boolean;
    userName: string;
  };
  mode: Extract<
    FrontendPageMode,
    'global_overview' | 'restaurant_workspace'
  >;
  shortcuts: DashboardShortcut[];
};

function buildShortcuts(session: FrontendSessionView): DashboardShortcut[] {
  const shortcuts: DashboardShortcut[] = [];

  if (session.capabilities.navigation.employees) {
    shortcuts.push({
      description: 'Alta, edicion y estado de usuarios operativos por restaurante.',
      href: '/employees',
      label: 'Gestion de empleados',
    });
  }

  if (session.capabilities.navigation.schedules) {
    shortcuts.push({
      description: 'Consulta o gestiona el horario semanal segun tus permisos.',
      href: '/horarios',
      label: 'Horarios',
    });
  }

  if (session.capabilities.navigation.tasks) {
    shortcuts.push({
      description: 'Operaciones diarias y comprobantes.',
      href: '/tasks',
      label: 'Tareas',
    });
  }

  if (session.capabilities.navigation.requests) {
    shortcuts.push({
      description: 'Solicitudes internas y aprobaciones.',
      href: '/requests',
      label: 'Solicitudes',
    });
  }

  if (session.capabilities.navigation.incidents) {
    shortcuts.push({
      description: 'Avisos operativos, seguimiento y asignacion de responsables.',
      href: '/incidents',
      label: 'Incidencias',
    });
  }

  if (session.capabilities.navigation.documents) {
    shortcuts.push({
      description: 'Contratos, documentos y archivos sensibles.',
      href: '/documents',
      label: 'Documentos',
    });
  }

  if (session.capabilities.navigation.procurement) {
    shortcuts.push({
      description: 'Proveedores, albaranes y catalogo de compra.',
      href: '/suppliers',
      label: 'Proveedores',
    });
  }

  if (session.capabilities.navigation.notifications) {
    shortcuts.push({
      description: 'Notificaciones y avisos personales.',
      href: '/notifications',
      label: 'Avisos',
    });
  }

  return shortcuts;
}

function resolveDashboardMode(
  session: FrontendSessionView,
): DashboardPageViewModel['mode'] {
  if (
    session.capabilities.context.isRestaurantScope ||
    session.capabilities.context.isZoneScope
  ) {
    return 'restaurant_workspace';
  }

  return 'global_overview';
}

export function buildDashboardPageViewModel(
  session: FrontendSessionView,
): DashboardPageViewModel {
  const currentRestaurant = session.visibleRestaurants.find(
    (restaurant) => restaurant.id === session.effectiveRestaurantId,
  );

  return {
    hero: {
      activeScopeLabel: currentRestaurant?.name ?? session.activeScope.label,
      canSelectScope: session.capabilities.context.canSelectScope,
      isGlobalScope: session.capabilities.context.isGlobalScope,
      userName: session.person.fullName || 'Sin nombre',
    },
    mode: resolveDashboardMode(session),
    shortcuts: buildShortcuts(session),
  };
}
