'use client';

import { LayoutDashboard, UserCircle, Users } from 'lucide-react';
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

  return (
    <nav 
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t border-border bg-background/90 pb-safe pt-1 backdrop-blur-lg"
      aria-label="Navegacion operativa"
    >
      <Link
        href="/app"
        className={`flex flex-col items-center justify-center gap-1 w-full h-full transition-colors ${
          isActive(pathname, '/app') ? 'text-accent-strong' : 'text-muted hover:text-foreground'
        }`}
        aria-current={isActive(pathname, '/app') ? 'page' : undefined}
      >
        <LayoutDashboard className="h-5 w-5" strokeWidth={isActive(pathname, '/app') ? 2.5 : 2} />
        <span className="text-[10px] font-medium tracking-wide">Dashboard</span>
      </Link>

      {canSeeEmployees && (
        <Link
          href="/employees"
          className={`flex flex-col items-center justify-center gap-1 w-full h-full transition-colors ${
            isActive(pathname, '/employees') ? 'text-accent-strong' : 'text-muted hover:text-foreground'
          }`}
          aria-current={isActive(pathname, '/employees') ? 'page' : undefined}
        >
          <Users className="h-5 w-5" strokeWidth={isActive(pathname, '/employees') ? 2.5 : 2} />
          <span className="text-[10px] font-medium tracking-wide">Personal</span>
        </Link>
      )}

      <Link
        href="/me"
        className={`flex flex-col items-center justify-center gap-1 w-full h-full transition-colors ${
          isActive(pathname, '/me') ? 'text-accent-strong' : 'text-muted hover:text-foreground'
        }`}
        aria-current={isActive(pathname, '/me') ? 'page' : undefined}
      >
        <UserCircle className="h-5 w-5" strokeWidth={isActive(pathname, '/me') ? 2.5 : 2} />
        <span className="text-[10px] font-medium tracking-wide">Mi Perfil</span>
      </Link>
    </nav>
  );
}
