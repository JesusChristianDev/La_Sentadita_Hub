'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type Props = {
  canSeeEmployees: boolean;
};

function isActive(pathname: string, href: string): boolean {
  if (href === '/employees') return pathname === '/employees' || pathname.startsWith('/employees/');
  return pathname === href;
}

export function ScreenNav({ canSeeEmployees }: Props) {
  const pathname = usePathname();

  const getLinkClasses = (href: string) => {
    const active = isActive(pathname, href);
    return `rounded-md px-3 md:px-4 py-2 text-sm font-medium transition-colors ${
      active 
        ? 'bg-surface-strong text-foreground' 
        : 'text-muted hover:bg-surface-strong/50 hover:text-foreground'
    }`;
  };

  return (
    <nav className="hidden md:flex flex-wrap items-center gap-2 md:gap-4 lg:gap-6" aria-label="Navegacion principal de pantallas">
      <Link href="/app" className={getLinkClasses('/app')} aria-current={isActive(pathname, '/app') ? 'page' : undefined}>
        Dashboard
      </Link>
      {canSeeEmployees ? (
        <Link href="/employees" className={getLinkClasses('/employees')} aria-current={isActive(pathname, '/employees') ? 'page' : undefined}>
          Personal
        </Link>
      ) : null}
    </nav>
  );
}
