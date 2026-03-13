'use client';

import {
  CalendarDays,
  LayoutDashboard,
  type LucideIcon,
  UserCircle,
  Users,
} from 'lucide-react';

type BuildAppNavigationItemsParams = {
  canSeeEmployees: boolean;
  canSeeSchedules: boolean;
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
  if (href === '/employees') {
    return pathname === '/employees' || pathname.startsWith('/employees/');
  }

  return pathname === href;
}

export function buildAppNavigationItems({
  canSeeEmployees,
  canSeeSchedules,
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
