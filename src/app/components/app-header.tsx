import Link from 'next/link';

import type { AppRole } from '@/modules/auth_users';

import { BottomTabBar } from './bottom-tab-bar';
import { MobileHeaderMenu } from './mobile-header-menu';
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
      <header className="app-header">
        <div className="app-header-inner">
          <Link href="/app" className="app-logo">
            La Sentadita Hub
          </Link>

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

          <ScreenNav canSeeEmployees={canSeeEmployees} />

          <div className="header-right">
            {canPickRestaurant && setActiveRestaurantAction ? (
              <form action={setActiveRestaurantAction} className="header-restaurant-form">
                <select
                  className="header-restaurant-select"
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
                <button className="header-small-btn" type="submit">
                  Aplicar
                </button>
              </form>
            ) : null}

            <details className="header-account">
              <summary className="header-avatar">
                <span className="header-avatar-content">
                  <UserAvatar
                    fullName={currentUserName}
                    role={currentUserRole}
                    avatarUrl={currentUserAvatarUrl}
                    size="md"
                  />
                  <span className="header-avatar-label">{shortName}</span>
                </span>
              </summary>
              <div className="header-popover">
                <Link href="/me" className="header-menu-link">
                  Mi perfil
                </Link>
                <form action="/api/auth/signout" method="post">
                  <input type="hidden" name="next" value="/login" />
                  <button type="submit" className="header-menu-link danger">
                    Cerrar sesion
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
