import { redirect } from 'next/navigation';

import { getCurrentUserContext } from '@/modules/auth_users';
import { can } from '@/modules/authz';
import { listRestaurants } from '@/modules/restaurants';
import { getIsMobileDevice } from '@/shared/deviceDetection';
import { createSupabaseAdminClient } from '@/shared/supabase/admin';

import { ResponsiveAppFrame } from '../components/responsive-app-frame';
import { setActiveRestaurant } from './app/actions';

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getCurrentUserContext();
  if (!ctx) redirect('/login');
  const initialIsMobileHint = await getIsMobileDevice();

  const showSelector = can(ctx.requestContext, 'restaurant_context.select');
  const restaurants = showSelector ? await listRestaurants() : [];
  const effectiveRestaurantId = ctx.requestContext.effectiveRestaurantId;

  const admin = createSupabaseAdminClient();
  let currentUserAvatarUrl: string | null = null;
  if (ctx.person.avatar_path) {
    const { data } = await admin.storage
      .from('avatars')
      .createSignedUrl(ctx.person.avatar_path, 60 * 60);
    currentUserAvatarUrl = data?.signedUrl ?? null;
  }

  return (
    <ResponsiveAppFrame
      canSeeEmployees={can(ctx.requestContext, 'employees.view')}
      canSeeSchedules={can(ctx.requestContext, 'schedule.view')}
      canPickRestaurant={showSelector}
      restaurants={restaurants}
      effectiveRestaurantId={effectiveRestaurantId}
      initialIsMobileHint={initialIsMobileHint}
      setActiveRestaurantAction={setActiveRestaurant}
      currentUserName={ctx.person.full_name}
      currentUserRole={ctx.requestContext.systemRole}
      currentUserAvatarUrl={currentUserAvatarUrl}
    >
      {children}
    </ResponsiveAppFrame>
  );
}
