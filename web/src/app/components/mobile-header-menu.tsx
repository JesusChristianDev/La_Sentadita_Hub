'use client';

import {
  LogOut,
  Menu,
  Store,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import type { AppRole } from '@/modules/auth_users';
import { roleLabel } from '@/shared/roleLabel';
import { Button, Select } from '@/shared/ui';

import {
  buildAppNavigationItems,
  isAppNavigationItemActive,
} from './app-navigation';
import { UserAvatar } from './user-avatar';

type RestaurantOption = {
  id: string;
  name: string;
};

type Props = {
  canSeeEmployees: boolean;
  canSeeSchedules: boolean;
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
  canSeeSchedules,
  canPickRestaurant = false,
  restaurants = [],
  effectiveRestaurantId = null,
  setActiveRestaurantAction,
  currentUserName = null,
  currentUserRole = null,
  currentUserAvatarUrl = null,
}: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const titleId = useId();
  const drawerId = 'mobile-menu-drawer';
  const items = buildAppNavigationItems({
    canSeeEmployees,
    canSeeSchedules,
    includeProfile: true,
  });
  const closeAfterSubmit = () => {
    window.setTimeout(() => {
      setOpen(false);
    }, 0);
  };

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) {
      document.body.style.overflow = '';
      return;
    }

    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      menuButtonRef.current?.focus();
      return;
    }

    const focusableElements = drawerRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    focusableElements?.[0]?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handleTrapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !drawerRef.current) return;

      const focusableElements = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter(
        (element) =>
          !element.hasAttribute('disabled') &&
          element.getAttribute('aria-hidden') !== 'true',
      );

      if (!focusableElements.length) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    window.addEventListener('keydown', handleTrapFocus);
    return () => window.removeEventListener('keydown', handleTrapFocus);
  }, [open]);

  return (
    <div>
      <button
        ref={menuButtonRef}
        type="button"
        className="inline-flex h-12 w-12 items-center justify-center rounded-[1.35rem] border border-white/10 bg-white/[0.05] text-foreground shadow-[0_18px_38px_-28px_rgba(0,0,0,0.9)] transition-colors hover:bg-white/[0.09] focus:outline-none focus:ring-2 focus:ring-accent"
        aria-label={open ? 'Cerrar menu' : 'Abrir menu'}
        aria-expanded={open}
        aria-controls={drawerId}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {open
        ? createPortal(
            <>
              <div
                className={`fixed inset-0 z-[110] bg-black/70 backdrop-blur-md transition-opacity duration-300 ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
                aria-hidden="true"
                onClick={() => setOpen(false)}
              />

              <aside
                ref={drawerRef}
                id={drawerId}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className={`fixed inset-x-0 bottom-0 z-[120] mx-auto w-full transition-transform duration-300 ease-out ${open ? 'translate-y-0' : 'translate-y-full'}`}
                aria-hidden={!open}
              >
                <div className="mx-2 flex max-h-[calc(100dvh-0.5rem)] flex-col overflow-y-auto rounded-t-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(22,22,29,0.98)_0%,rgba(8,8,12,0.99)_100%)] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1.15rem)] pt-3 shadow-[0_-32px_90px_-40px_rgba(0,0,0,0.98)] sm:mx-auto sm:mb-4 sm:max-h-[min(44rem,calc(100dvh-2rem))] sm:max-w-[42rem] sm:rounded-[2rem] sm:px-5">
                  <div className="mx-auto h-1.5 w-16 rounded-full bg-white/10" />

                  <div className="mt-4 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 rounded-[1.75rem] border border-white/8 bg-white/[0.04] px-4 py-4 shadow-[0_18px_42px_-32px_rgba(0,0,0,0.8)]">
                      <div className="flex items-center gap-3">
                        <UserAvatar
                          fullName={currentUserName}
                          role={currentUserRole}
                          avatarUrl={currentUserAvatarUrl}
                          size="md"
                        />
                        <div className="min-w-0">
                          <strong
                            className="block truncate text-base font-semibold text-foreground"
                            id={titleId}
                          >
                            {currentUserName?.trim() || 'Cuenta'}
                          </strong>
                          <span className="block text-xs font-medium uppercase tracking-[0.18em] text-muted">
                            {currentUserRole ? roleLabel(currentUserRole) : 'Usuario'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[1.25rem] border border-white/10 bg-white/[0.05] text-muted transition-colors hover:bg-white/[0.1]"
                      onClick={() => setOpen(false)}
                    >
                      <span className="sr-only">Cerrar panel</span>
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <nav
                    className="mt-5 grid grid-cols-2 gap-3"
                    aria-label="Navegacion principal movil"
                  >
                    {items.map((item) => {
                      const active = isAppNavigationItemActive(pathname, item.href);
                      const Icon = item.icon;

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`flex min-h-28 flex-col items-start justify-between rounded-[1.55rem] border px-4 py-4 text-sm font-medium transition-all ${
                            active
                              ? 'border-accent/40 bg-accent/12 text-foreground shadow-[0_18px_38px_-30px_rgba(245,158,11,0.8)]'
                              : 'border-white/8 bg-white/[0.04] text-foreground hover:bg-white/[0.08]'
                          }`}
                          onClick={() => setOpen(false)}
                          aria-current={active ? 'page' : undefined}
                        >
                          <span className="flex items-center gap-3">
                            <span
                              className={`inline-flex h-11 w-11 items-center justify-center rounded-[1.05rem] ${
                                active
                                  ? 'bg-accent/18 text-accent-strong'
                                  : 'bg-white/[0.05] text-muted'
                              }`}
                            >
                              <Icon className="h-5 w-5" />
                            </span>
                          </span>
                          <span className="block">
                            <span className="block text-sm font-semibold text-foreground">
                              {item.label}
                            </span>
                            <span className="mt-1 block text-xs text-muted">
                              {item.mobileDescription}
                            </span>
                          </span>
                        </Link>
                      );
                    })}
                  </nav>

                  {canPickRestaurant && setActiveRestaurantAction ? (
                    <form
                      action={setActiveRestaurantAction}
                      className="mt-6 grid gap-3 rounded-[1.75rem] border border-border/70 bg-surface/70 p-4"
                      onSubmit={closeAfterSubmit}
                    >
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent/14 text-accent-strong">
                          <Store className="h-5 w-5" />
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-foreground">Sucursal activa</p>
                          <p className="text-xs text-muted">
                            Cambia el contexto del restaurante.
                          </p>
                        </div>
                      </div>

                      <Select
                        id="mobile-restaurant-select"
                        className="min-h-11 rounded-2xl bg-surface-strong"
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
                      </Select>

                      <Button className="w-full rounded-2xl" type="submit">
                        Aplicar sucursal
                      </Button>
                    </form>
                  ) : null}

                  <div className="mt-auto pt-6">
                    <form
                      action="/api/auth/signout"
                      method="post"
                      onSubmit={closeAfterSubmit}
                    >
                      <input type="hidden" name="next" value="/login" />
                      <Button
                        className="w-full rounded-[1.4rem]"
                        type="submit"
                        variant="danger"
                      >
                        <LogOut className="h-4 w-4" />
                        Cerrar sesion
                      </Button>
                    </form>
                  </div>
                </div>
              </aside>
            </>,
            document.body,
          )
        : null}
    </div>
  );
}
