'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import {
  buildAppNavigationItems,
  isAppNavigationItemActive,
} from './app-navigation';

type Props = {
  canSeeEmployees: boolean;
  canSeeDocuments?: boolean;
  canSeeIncidents?: boolean;
  canSeeNotifications?: boolean;
  canSeeRequests?: boolean;
  canSeeProcurement?: boolean;
  canSeeSchedules: boolean;
  canSeeTasks?: boolean;
  className?: string;
};

import { NavDropdown } from './nav-dropdown';

export function ScreenNav({
  canSeeEmployees,
  canSeeDocuments = false,
  canSeeIncidents = false,
  canSeeNotifications = false,
  canSeeRequests = false,
  canSeeProcurement = false,
  canSeeSchedules,
  canSeeTasks = false,
  className = 'hidden min-w-0 flex-1 items-center justify-center lg:flex',
}: Props) {
  const pathname = usePathname();
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  const items = buildAppNavigationItems({
    canSeeEmployees,
    canSeeDocuments,
    canSeeIncidents,
    canSeeNotifications,
    canSeeRequests,
    canSeeProcurement,
    canSeeSchedules,
    canSeeTasks,
  });

  const getLinkClasses = (href: string) => {
    const active = isAppNavigationItemActive(pathname, href);

    return `inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-all ${
      active
        ? 'border-accent/40 bg-accent/15 text-foreground shadow-[0_10px_26px_-18px_rgba(245,158,11,0.6)]'
        : 'border-transparent text-muted hover:border-border hover:bg-surface-strong/60 hover:text-foreground'
    }`;
  };

  // Group items by category
  const dashboardItem = items.find((item) => item.href === '/app');
  const equipoItems = items.filter((item) => item.category === 'equipo');
  const operacionesItems = items.filter((item) => item.category === 'operaciones');
  const recursosItems = items.filter((item) => item.category === 'recursos');
  const avisosItems = items.filter((item) => item.category === 'avisos');

  return (
    <nav className={className} aria-label="Navegacion principal de pantallas">
      <div className="flex max-w-full min-w-0 items-center justify-center gap-2 overflow-visible rounded-full border border-border/70 bg-surface/70 p-1.5 shadow-[0_18px_38px_-28px_rgba(0,0,0,0.7)] backdrop-blur">
        {dashboardItem && (
          <Link
            href={dashboardItem.href}
            className={getLinkClasses(dashboardItem.href)}
            aria-current={
              isAppNavigationItemActive(pathname, dashboardItem.href)
                ? 'page'
                : undefined
            }
          >
            {dashboardItem.label}
          </Link>
        )}

        {equipoItems.length > 0 && (
          <NavDropdown
            label="Equipo"
            items={equipoItems}
            isOpen={activeDropdown === 'equipo'}
            onOpen={() => setActiveDropdown('equipo')}
            onClose={() => setActiveDropdown(null)}
          />
        )}

        {operacionesItems.length > 0 && (
          <NavDropdown
            label="Operaciones"
            items={operacionesItems}
            isOpen={activeDropdown === 'operaciones'}
            onOpen={() => setActiveDropdown('operaciones')}
            onClose={() => setActiveDropdown(null)}
          />
        )}

        {recursosItems.length > 0 && (
          <NavDropdown
            label="Recursos"
            items={recursosItems}
            isOpen={activeDropdown === 'recursos'}
            onOpen={() => setActiveDropdown('recursos')}
            onClose={() => setActiveDropdown(null)}
          />
        )}

        {avisosItems.length > 0 && (
          <div className="flex items-center">
            <div className="h-4 w-px bg-border/50 mx-1" />
            {avisosItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={getLinkClasses(item.href)}
                aria-current={
                  isAppNavigationItemActive(pathname, item.href) ? 'page' : undefined
                }
              >
                {item.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}
