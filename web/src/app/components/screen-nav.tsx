'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
  buildAppNavigationItems,
  isAppNavigationItemActive,
} from './app-navigation';

type Props = {
  canSeeEmployees: boolean;
  canSeeSchedules: boolean;
  className?: string;
};

export function ScreenNav({
  canSeeEmployees,
  canSeeSchedules,
  className = 'hidden min-w-0 flex-1 items-center justify-center lg:flex',
}: Props) {
  const pathname = usePathname();
  const items = buildAppNavigationItems({
    canSeeEmployees,
    canSeeSchedules,
  });

  const getLinkClasses = (href: string) => {
    const active = isAppNavigationItemActive(pathname, href);

    return `inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-all ${
      active
        ? 'border-accent/50 bg-accent/15 text-foreground shadow-[0_10px_26px_-18px_rgba(245,158,11,0.7)]'
        : 'border-transparent text-muted hover:border-border hover:bg-surface-strong/60 hover:text-foreground'
    }`;
  };

  return (
    <nav className={className} aria-label="Navegacion principal de pantallas">
      <div className="flex max-w-full min-w-0 items-center justify-center gap-2 overflow-x-auto rounded-full border border-border/70 bg-surface/70 p-1.5 shadow-[0_18px_38px_-28px_rgba(0,0,0,0.7)] backdrop-blur [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => (
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
    </nav>
  );
}
