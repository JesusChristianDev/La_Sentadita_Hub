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
  category?: 'equipo' | 'operaciones' | 'recursos' | 'avisos' | 'perfil';
  description?: string;
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
      description: 'Vista general del estado de tus restaurantes.',
    },
    ...(canSeeEmployees
      ? [
          {
            href: '/employees',
            icon: Users,
            label: 'Personal',
            mobileDescription: 'Gestión del equipo',
            shortLabel: 'Personal',
            category: 'equipo' as const,
            description: 'Gestiona la plantilla, roles y expedientes.',
          },
        ]
      : []),
    ...(canSeeSchedules
      ? [
          {
            href: '/horarios',
            icon: CalendarDays,
            label: 'Horarios',
            mobileDescription: 'Operación semanal',
            shortLabel: 'Horarios',
            category: 'equipo' as const,
            description: 'Turnos, rotaciones y cuadrantes semanales.',
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
            category: 'operaciones' as const,
            description: 'Listas de control y tareas operativas.',
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
            category: 'operaciones' as const,
            description: 'Altas, bajas y modificaciones de personal.',
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
            category: 'operaciones' as const,
            description: 'Reportes de anomalías y seguimiento.',
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
            category: 'recursos' as const,
            description: 'Contratos, nóminas y biblioteca compartida.',
          },
        ]
      : []),
    ...(canSeeProcurement
      ? [
          {
            href: '/suppliers',
            icon: Package,
            label: 'Proveedores',
            mobileDescription: 'Albaranes y catálogo',
            shortLabel: 'Compras',
            category: 'recursos' as const,
            description: 'Entrada de mercancía y gestión de productos.',
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
            category: 'avisos' as const,
            description: 'Centro de notificaciones y alertas.',
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
            shortLabel: 'Perfil',
            category: 'perfil' as const,
            description: 'Datos personales y preferencias.',
          },
        ]
      : []),
  ];
}
