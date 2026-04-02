'use client';

import {
  AlertTriangle,
  Bell,
  CalendarDays,
  CheckSquare,
  FileText,
  LayoutDashboard,
  type LucideIcon,
  Package,
  UserCircle,
  Users,
} from 'lucide-react';

type BuildAppNavigationItemsParams = {
  canSeeEmployees: boolean;
  canSeeDocuments?: boolean;
  canSeeIncidents?: boolean;
  canSeeNotifications?: boolean;
  canSeeRequests?: boolean;
  canSeeProcurement?: boolean;
  canSeeSchedules: boolean;
  canSeeTasks?: boolean;
  includeProfile?: boolean;
};

export type AppNavigationItem = {
  href: string;
  icon: LucideIcon;
  label: string;
  mobileDescription: string;
  shortLabel: string;
};

export function isAppNavigationItemActive(pathname: string, href: string): boolean {
  if (href === '/app') {
    return pathname === '/app';
  }

  if (href === '/me') {
    return pathname === '/me';
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function buildAppNavigationItems({
  canSeeEmployees,
  canSeeDocuments = false,
  canSeeIncidents = false,
  canSeeNotifications = false,
  canSeeProcurement = false,
  canSeeSchedules,
  canSeeTasks = false,
  canSeeRequests = false,
  includeProfile = false,
}: BuildAppNavigationItemsParams): AppNavigationItem[] {
  return [
    {
      href: '/app',
      icon: LayoutDashboard,
      label: 'Dashboard',
      mobileDescription: 'Vista general',
      shortLabel: 'Panel',
    },
    ...(canSeeEmployees
      ? [
          {
            href: '/employees',
            icon: Users,
            label: 'Personal',
            mobileDescription: 'Gestion del equipo',
            shortLabel: 'Personal',
          },
        ]
      : []),
    ...(canSeeSchedules
      ? [
          {
            href: '/horarios',
            icon: CalendarDays,
            label: 'Horarios',
            mobileDescription: 'Operacion semanal',
            shortLabel: 'Horarios',
          },
        ]
      : []),
    ...(canSeeTasks
      ? [
          {
            href: '/tasks',
            icon: CheckSquare,
            label: 'Tareas',
            mobileDescription: 'Operaciones diarias',
            shortLabel: 'Tareas',
          },
        ]
      : []),
    ...(canSeeRequests
      ? [
          {
            href: '/requests',
            icon: FileText,
            label: 'Solicitudes',
            mobileDescription: 'Solicitudes operativas',
            shortLabel: 'Solicitudes',
          },
        ]
      : []),
    ...(canSeeIncidents
      ? [
          {
            href: '/incidents',
            icon: AlertTriangle,
            label: 'Incidencias',
            mobileDescription: 'Avisos y seguimiento',
            shortLabel: 'Incidencias',
          },
        ]
      : []),
    ...(canSeeDocuments
      ? [
          {
            href: '/documents',
            icon: FileText,
            label: 'Documentos',
            mobileDescription: 'Contratos y archivos',
            shortLabel: 'Docs',
          },
        ]
      : []),
    ...(canSeeProcurement
      ? [
          {
            href: '/suppliers',
            icon: Package,
            label: 'Proveedores',
            mobileDescription: 'Albaranes y catalogo',
            shortLabel: 'Compras',
          },
        ]
      : []),
    ...(canSeeNotifications
      ? [
          {
            href: '/notifications',
            icon: Bell,
            label: 'Avisos',
            mobileDescription: 'Tus notificaciones',
            shortLabel: 'Avisos',
          },
        ]
      : []),
    ...(includeProfile
      ? [
          {
            href: '/me',
            icon: UserCircle,
            label: 'Mi perfil',
            mobileDescription: 'Tu cuenta',
            shortLabel: 'Mi perfil',
          },
        ]
      : []),
  ];
}
