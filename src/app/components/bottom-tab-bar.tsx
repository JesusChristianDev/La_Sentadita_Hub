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

export function BottomTabBar({ canSeeEmployees }: Props) {
  const pathname = usePathname();
  const secondHref = canSeeEmployees ? '/employees' : '/me';
  const secondLabel = canSeeEmployees ? 'Personal' : 'Perfil';

  return (
    <nav className="bottom-tab-bar" aria-label="Navegacion operativa">
      <Link
        href="/app"
        className={isActive(pathname, '/app') ? 'bottom-tab-link active' : 'bottom-tab-link'}
        aria-current={isActive(pathname, '/app') ? 'page' : undefined}
      >
        <span className="bottom-tab-icon">DB</span>
        <span className="bottom-tab-text">Dashboard</span>
      </Link>

      <Link
        href={secondHref}
        className={isActive(pathname, secondHref) ? 'bottom-tab-link active' : 'bottom-tab-link'}
        aria-current={isActive(pathname, secondHref) ? 'page' : undefined}
      >
        <span className="bottom-tab-icon">PR</span>
        <span className="bottom-tab-text">{secondLabel}</span>
      </Link>

      <Link
        href="/me"
        className={isActive(pathname, '/me') ? 'bottom-tab-link active' : 'bottom-tab-link'}
        aria-current={isActive(pathname, '/me') ? 'page' : undefined}
      >
        <span className="bottom-tab-icon">CU</span>
        <span className="bottom-tab-text">Cuenta</span>
      </Link>
    </nav>
  );
}
