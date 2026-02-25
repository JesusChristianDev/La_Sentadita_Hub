'use client';

import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import type { AppRole } from '@/modules/auth_users';
import { roleLabel } from '@/shared/roleLabel';

import { UserAvatar } from './user-avatar';

type RestaurantOption = {
  id: string;
  name: string;
};

type Props = {
  canSeeEmployees: boolean;
  canPickRestaurant?: boolean;
  restaurants?: RestaurantOption[];
  effectiveRestaurantId?: string | null;
  setActiveRestaurantAction?: (formData: FormData) => void;
  currentUserName?: string | null;
  currentUserRole?: AppRole | null;
  currentUserAvatarUrl?: string | null;
};

export function MobileHeaderMenu({
  canSeeEmployees,
  canPickRestaurant = false,
  restaurants = [],
  effectiveRestaurantId = null,
  setActiveRestaurantAction,
  currentUserName = null,
  currentUserRole = null,
  currentUserAvatarUrl = null,
}: Props) {
  const [open, setOpen] = useState(false);
  const drawerId = 'mobile-menu-drawer';

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        className="inline-flex h-10 w-10 items-center justify-center rounded-md text-muted hover:bg-surface-strong hover:text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
        aria-label={open ? 'Cerrar menu' : 'Abrir menu'}
        aria-expanded={open}
        aria-controls={drawerId}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {/* Overlay */}
      <div 
        className={`fixed inset-0 z-40 bg-background/80 backdrop-blur-sm transition-opacity ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        aria-hidden="true"
        onClick={() => setOpen(false)}
      />

      {/* Drawer */}
      <aside 
        id={drawerId} 
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-xs flex flex-col gap-6 border-l border-border bg-background px-6 py-6 shadow-2xl transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between border-b border-border pb-5">
          <div className="flex items-center gap-3">
            <UserAvatar
              fullName={currentUserName}
              role={currentUserRole}
              avatarUrl={currentUserAvatarUrl}
              size="md"
            />
            <div className="flex flex-col">
              <strong className="text-base font-semibold text-foreground truncate max-w-[150px]">{currentUserName?.trim() || 'Cuenta'}</strong>
              <span className="text-xs font-medium text-muted">{currentUserRole ? roleLabel(currentUserRole) : 'Usuario'}</span>
            </div>
          </div>
          <button
            type="button"
            className="rounded-md text-muted hover:bg-surface-strong hover:text-foreground p-2"
            onClick={() => setOpen(false)}
          >
            <span className="sr-only">Close panel</span>
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex flex-col gap-2" aria-label="Navegacion principal movil">
          <Link href="/app" className="rounded-md px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-strong" onClick={() => setOpen(false)}>
            Dashboard
          </Link>
          {canSeeEmployees ? (
            <Link href="/employees" className="rounded-md px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-strong" onClick={() => setOpen(false)}>
              Personal
            </Link>
          ) : null}
          <Link href="/me" className="rounded-md px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-strong" onClick={() => setOpen(false)}>
            Mi perfil
          </Link>
        </nav>

        {canPickRestaurant && setActiveRestaurantAction ? (
          <form action={setActiveRestaurantAction} className="flex flex-col gap-3 border-y border-border py-5" onSubmit={() => setOpen(false)}>
            <label htmlFor="mobile-restaurant-select" className="text-xs font-semibold text-muted uppercase tracking-wider">Sucursal activa</label>
            <select
              id="mobile-restaurant-select"
              className="w-full rounded-md border border-border bg-surface-strong px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              defaultValue={effectiveRestaurantId ?? ''}
              name="restaurantId"
              aria-label="Sucursal activa"
            >
              <option value="" disabled>
                Selecciona sucursal...
              </option>
              {restaurants.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <button className="w-full inline-flex items-center justify-center rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-strong focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 transition-colors" type="submit">
              Aplicar Sucursal
            </button>
          </form>
        ) : null}

        <div className="mt-auto pb-4">
          <form action="/api/auth/signout" method="post" onSubmit={() => setOpen(false)}>
            <input type="hidden" name="next" value="/login" />
            <button type="submit" className="flex w-full items-center justify-center rounded-md border border-danger/50 bg-danger/20 px-4 py-2.5 text-sm font-semibold text-danger transition-colors hover:bg-danger/30 hover:text-white">
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>
    </div>
  );
}
