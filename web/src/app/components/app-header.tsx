'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';

import type { AppRole } from '@/modules/auth_users';
import { Button, Select } from '@/shared/ui';

import { ScreenNav } from './screen-nav';
import { UserAvatar } from './user-avatar';

const MobileHeaderMenu = dynamic(() =>
  import('./mobile-header-menu').then((mod) => mod.MobileHeaderMenu),
);

type RestaurantOption = {
  id: string;
  name: string;
  is_active: boolean;
};

export type AppHeaderProps = {
  canSeeEmployees: boolean;
  canSeeSchedules: boolean;
  canPickRestaurant?: boolean;
  restaurants?: RestaurantOption[];
  effectiveRestaurantId?: string | null;
  isMobileDevice?: boolean;
  setActiveRestaurantAction?: (formData: FormData) => void;
  currentUserName?: string | null;
  currentUserRole?: AppRole | null;
  currentUserAvatarUrl?: string | null;
};

export function AppHeader({
  canSeeEmployees,
  canSeeSchedules,
  canPickRestaurant = false,
  restaurants = [],
  effectiveRestaurantId = null,
  isMobileDevice = false,
  setActiveRestaurantAction,
  currentUserName = null,
  currentUserRole = null,
  currentUserAvatarUrl = null,
}: AppHeaderProps) {
  const availableRestaurants = restaurants.filter((restaurant) => restaurant.is_active);
  const shortName = currentUserName?.trim() || 'Cuenta';
  const [desktopMenuOpen, setDesktopMenuOpen] = useState(false);
  const desktopMenuId = useId();
  const desktopMenuRef = useRef<HTMLDivElement>(null);
  const isDesktopMenuVisible = desktopMenuOpen && !isMobileDevice;

  useEffect(() => {
    if (!isDesktopMenuVisible) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!desktopMenuRef.current?.contains(target)) {
        setDesktopMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDesktopMenuOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDesktopMenuVisible]);

  if (isMobileDevice) {
    return (
      <header
        data-app-header
        className="pointer-events-none fixed inset-x-0 top-0 z-50 px-3 pt-[calc(env(safe-area-inset-top,0px)+0.55rem)]"
      >
        <div className="pointer-events-auto mx-auto flex w-full items-center gap-3 rounded-[1.45rem] border border-white/10 bg-[linear-gradient(180deg,rgba(23,23,29,0.94)_0%,rgba(11,11,15,0.97)_100%)] px-3.5 py-2.5 shadow-[0_28px_70px_-42px_rgba(0,0,0,0.96)] backdrop-blur-xl">
          <div className="min-w-0 flex-1">
            <Link
              href="/app"
              className="block truncate text-[0.7rem] font-semibold uppercase tracking-[0.34em] text-accent-strong/90"
            >
              La Sentadita Hub
            </Link>
          </div>

          <div className="shrink-0">
            <MobileHeaderMenu
              canSeeEmployees={canSeeEmployees}
              canSeeSchedules={canSeeSchedules}
              canPickRestaurant={canPickRestaurant}
              restaurants={availableRestaurants}
              effectiveRestaurantId={effectiveRestaurantId}
              setActiveRestaurantAction={setActiveRestaurantAction}
              currentUserName={currentUserName}
              currentUserRole={currentUserRole}
              currentUserAvatarUrl={currentUserAvatarUrl}
            />
          </div>
        </div>
      </header>
    );
  }

  return (
    <>
      <header
        data-app-header
        className="sticky top-0 z-50 w-full border-b border-border/80 bg-background/92 backdrop-blur-xl"
      >
        <div className="mx-auto flex min-h-[4.5rem] w-full max-w-[1720px] items-center gap-3 px-4 sm:px-6 lg:px-7 xl:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-4 lg:gap-8">
            <Link
              href="/app"
              className="shrink-0 text-base font-bold tracking-tight text-white transition-colors hover:text-amber-500 sm:text-lg"
            >
              La Sentadita Hub
            </Link>

            <div className="min-w-0 flex-1">
              <ScreenNav
                canSeeEmployees={canSeeEmployees}
                canSeeSchedules={canSeeSchedules}
                className="flex min-w-0 flex-1 items-center justify-center"
              />
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-2 sm:gap-3 lg:gap-4">
            {canPickRestaurant && setActiveRestaurantAction ? (
              <form
                action={setActiveRestaurantAction}
                className="flex items-center gap-2 rounded-full border border-border bg-surface/70 p-1.5"
              >
                <Select
                  className="h-10 min-w-[10rem] max-w-[12rem] rounded-full border border-transparent bg-surface-strong px-4 py-0 text-sm lg:max-w-[14rem] xl:max-w-[18rem]"
                  defaultValue={effectiveRestaurantId ?? ''}
                  name="restaurantId"
                  aria-label="Sucursal activa"
                >
                  <option value="" disabled>
                    Sucursal...
                  </option>
                  {availableRestaurants.map((restaurant) => (
                    <option key={restaurant.id} value={restaurant.id}>
                      {restaurant.name}
                    </option>
                  ))}
                </Select>
                <Button
                  className="h-10 rounded-full px-4 py-0 text-sm"
                  type="submit"
                >
                  Aplicar
                </Button>
              </form>
            ) : null}

            <div ref={desktopMenuRef} className="relative block">
              <button
                type="button"
                className="flex cursor-pointer items-center gap-2 rounded-full border border-border bg-surface-strong/85 py-1 pl-1 pr-2 transition-colors hover:border-muted hover:bg-surface-muted focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 xl:pr-3"
                aria-expanded={isDesktopMenuVisible}
                aria-controls={desktopMenuId}
                aria-label={isDesktopMenuVisible ? 'Cerrar menu de cuenta' : 'Abrir menu de cuenta'}
                onClick={() => setDesktopMenuOpen((open) => !open)}
              >
                <UserAvatar
                  fullName={currentUserName}
                  role={currentUserRole}
                  avatarUrl={currentUserAvatarUrl}
                  size="md"
                />
                <span className="hidden max-w-[160px] truncate text-sm font-medium text-foreground xl:block">
                  {shortName}
                </span>
              </button>
              {isDesktopMenuVisible ? (
                <div
                  id={desktopMenuId}
                  className="absolute right-0 top-[calc(100%+8px)] z-50 flex min-w-[220px] flex-col gap-1 rounded-[1.15rem] border border-border bg-background/95 p-2 shadow-2xl backdrop-blur-xl"
                >
                  <Link
                    href="/me"
                    className="flex w-full items-center rounded-xl px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-surface hover:text-white"
                    onClick={() => setDesktopMenuOpen(false)}
                  >
                    Mi perfil
                  </Link>
                  <form
                    action="/api/auth/signout"
                    method="post"
                    className="m-0 w-full"
                    onSubmit={() => setDesktopMenuOpen(false)}
                  >
                    <input type="hidden" name="next" value="/login" />
                    <button
                      type="submit"
                      className="flex w-full items-center rounded-xl px-3 py-2.5 text-sm text-danger transition-colors hover:bg-danger/20 hover:text-danger"
                    >
                      Cerrar sesion
                    </button>
                  </form>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
