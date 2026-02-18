'use client';

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
    <div className={open ? 'mobile-menu is-open' : 'mobile-menu'}>
      <button
        type="button"
        className="mobile-menu-trigger"
        aria-label={open ? 'Cerrar menu de navegacion' : 'Abrir menu de navegacion'}
        aria-expanded={open}
        aria-controls={drawerId}
        onClick={() => setOpen((value) => !value)}
      >
        <span />
        <span />
        <span />
      </button>

      <button
        type="button"
        className="mobile-menu-overlay"
        aria-label="Cerrar menu"
        onClick={() => setOpen(false)}
      />

      <aside id={drawerId} className="mobile-menu-drawer" aria-hidden={!open}>
        <div className="mobile-menu-head">
          <div className="mobile-menu-user">
            <UserAvatar
              fullName={currentUserName}
              role={currentUserRole}
              avatarUrl={currentUserAvatarUrl}
              size="md"
            />
            <div className="mobile-menu-user-meta">
              <strong>{currentUserName?.trim() || 'Cuenta'}</strong>
              <span>{currentUserRole ? roleLabel(currentUserRole) : 'Usuario'}</span>
            </div>
          </div>
          <p>Navegacion y contexto de trabajo.</p>
        </div>
        {open ? (
          <>
            <nav className="mobile-drawer-nav" aria-label="Navegacion principal movil">
              <Link href="/app" className="mobile-drawer-link" onClick={() => setOpen(false)}>
                Dashboard
              </Link>
              {canSeeEmployees ? (
                <Link href="/employees" className="mobile-drawer-link" onClick={() => setOpen(false)}>
                  Personal
                </Link>
              ) : null}
              <Link href="/me" className="mobile-drawer-link" onClick={() => setOpen(false)}>
                Mi perfil
              </Link>
            </nav>

            {canPickRestaurant && setActiveRestaurantAction ? (
              <form action={setActiveRestaurantAction} className="mobile-drawer-form" onSubmit={() => setOpen(false)}>
                <label htmlFor="mobile-restaurant-select">Sucursal activa</label>
                <select
                  id="mobile-restaurant-select"
                  className="header-restaurant-select"
                  defaultValue={effectiveRestaurantId ?? ''}
                  name="restaurantId"
                  aria-label="Sucursal activa"
                >
                  <option value="" disabled>
                    Sucursal...
                  </option>
                  {restaurants.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <button className="header-small-btn" type="submit">
                  Aplicar
                </button>
              </form>
            ) : null}

            <form action="/api/auth/signout" method="post" onSubmit={() => setOpen(false)}>
              <input type="hidden" name="next" value="/login" />
              <button type="submit" className="header-menu-link danger">
                Cerrar sesion
              </button>
            </form>
          </>
        ) : null}
      </aside>
    </div>
  );
}
