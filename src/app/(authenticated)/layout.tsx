import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { getCurrentUserContext } from '@/modules/auth_users';
import { listRestaurants } from '@/modules/restaurants';
import { canPickRestaurantHeader, canSeeEmployeesInNav } from '@/shared/headerPolicy';
import { createSupabaseAdminClient } from '@/shared/supabase/admin';

import { AppHeader } from '../components/app-header';
import { setActiveRestaurant } from './app/actions';

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getCurrentUserContext();
  if (!ctx) redirect('/login');

  const store = await cookies();
  const activeRestaurantId = store.get('active_restaurant_id')?.value ?? null;
  const showSelector = canPickRestaurantHeader(ctx.profile.role);
  const restaurants = showSelector ? await listRestaurants() : [];
  
  const effectiveRestaurantId = showSelector
    ? (activeRestaurantId ?? ctx.profile.restaurant_id)
    : ctx.profile.restaurant_id;

  const admin = createSupabaseAdminClient();
  let currentUserAvatarUrl: string | null = null;
  if (ctx.profile.avatar_path) {
    const { data } = await admin.storage
      .from('avatars')
      .createSignedUrl(ctx.profile.avatar_path, 60 * 60);
    currentUserAvatarUrl = data?.signedUrl ?? null;
  }

  return (
    <>
      <AppHeader
        canSeeEmployees={canSeeEmployeesInNav(ctx.profile.role)}
        canPickRestaurant={showSelector}
        restaurants={restaurants}
        effectiveRestaurantId={effectiveRestaurantId}
        setActiveRestaurantAction={setActiveRestaurant}
        currentUserName={ctx.profile.full_name}
        currentUserRole={ctx.profile.role}
        currentUserAvatarUrl={currentUserAvatarUrl}
      />
      {children}
    </>
  );
}
