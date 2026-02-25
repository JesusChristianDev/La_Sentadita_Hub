import dynamic from 'next/dynamic';
import Link from 'next/link';

import type { AppRole } from '@/modules/auth_users';

const BottomTabBar = dynamic(() => import('./bottom-tab-bar').then((mod) => mod.BottomTabBar));
const MobileHeaderMenu = dynamic(() => import('./mobile-header-menu').then((mod) => mod.MobileHeaderMenu));
import { ScreenNav } from './screen-nav';
import { UserAvatar } from './user-avatar';

type RestaurantOption = {
  id: string;
  name: string;
  is_active: boolean;
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

export function AppHeader({
  canSeeEmployees,
  canPickRestaurant = false,
  restaurants = [],
  effectiveRestaurantId = null,
  setActiveRestaurantAction,
  currentUserName = null,
  currentUserRole = null,
  currentUserAvatarUrl = null,
}: Props) {
  const availableRestaurants = restaurants.filter((r) => r.is_active);
  const shortName = currentUserName?.trim() || 'Cuenta';

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-12">
          <div className="flex items-center gap-4 sm:gap-6 lg:gap-10">
            <Link href="/app" className="text-lg font-bold tracking-tight text-white transition-colors hover:text-amber-500">
              La Sentadita
            </Link>

            <ScreenNav canSeeEmployees={canSeeEmployees} />
          </div>

          <div className="flex items-center gap-3 sm:gap-4 lg:gap-6">
            <MobileHeaderMenu
              canSeeEmployees={canSeeEmployees}
              canPickRestaurant={canPickRestaurant}
              restaurants={availableRestaurants}
              effectiveRestaurantId={effectiveRestaurantId}
              setActiveRestaurantAction={setActiveRestaurantAction}
              currentUserName={currentUserName}
              currentUserRole={currentUserRole}
              currentUserAvatarUrl={currentUserAvatarUrl}
            />
            {canPickRestaurant && setActiveRestaurantAction ? (
              <form action={setActiveRestaurantAction} className="hidden sm:flex items-center gap-2">
                <select
                  className="h-9 rounded-md border border-border bg-surface-strong px-3 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors"
                  defaultValue={effectiveRestaurantId ?? ''}
                  name="restaurantId"
                  aria-label="Sucursal activa"
                >
                  <option value="" disabled>
                    Sucursal...
                  </option>
                  {availableRestaurants.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <button 
                  className="inline-flex h-9 items-center justify-center rounded-md bg-accent px-4 text-sm font-medium text-white transition-colors hover:bg-accent-strong focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2" 
                  type="submit"
                >
                  Aplicar
                </button>
              </form>
            ) : null}

            <details className="group relative hidden md:block">
              <summary className="flex cursor-pointer items-center gap-2 rounded-full border border-border bg-surface-strong py-1 pl-1 pr-3 transition-colors hover:border-muted hover:bg-surface-muted focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 list-none [&::-webkit-details-marker]:hidden">
                <UserAvatar
                  fullName={currentUserName}
                  role={currentUserRole}
                  avatarUrl={currentUserAvatarUrl}
                  size="md"
                />
                <span className="max-w-[120px] truncate text-sm font-medium text-foreground">
                  {shortName}
                </span>
              </summary>
              <div className="absolute right-0 top-[calc(100%+8px)] z-50 hidden min-w-[200px] flex-col gap-1 rounded-xl border border-border bg-background/95 p-2 shadow-2xl backdrop-blur-xl group-open:flex">
                <Link href="/me" className="flex items-center w-full rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-surface hover:text-white">
                  Mi Perfil
                </Link>
                <form action="/api/auth/signout" method="post" className="m-0 w-full">
                  <input type="hidden" name="next" value="/login" />
                  <button type="submit" className="flex w-full items-center rounded-md px-3 py-2 text-sm text-danger transition-colors hover:bg-danger/20 hover:text-danger">
                    Cerrar Sesión
                  </button>
                </form>
              </div>
            </details>
          </div>
        </div>
      </header>
      <BottomTabBar canSeeEmployees={canSeeEmployees} />
    </>
  );
}
