import { redirect } from 'next/navigation';

import {
  buildAuthenticatedShellViewModel,
  buildFrontendSessionView,
  getCurrentUserContext,
} from '@/modules/auth_users';
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
  const frontendSession = buildFrontendSessionView(ctx);
  const shellView = buildAuthenticatedShellViewModel(frontendSession);

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
      activeScopeLabel={shellView.activeScopeLabel}
      canSeeDocuments={shellView.navigation.documents}
      canSeeEmployees={shellView.navigation.employees}
      canSeeIncidents={shellView.navigation.incidents}
      canSeeNotifications={shellView.navigation.notifications}
      canSeeProcurement={shellView.navigation.procurement}
      canSeeRequests={shellView.navigation.requests}
      canSeeSchedules={shellView.navigation.schedules}
      canSeeTasks={shellView.navigation.tasks}
      canPickRestaurant={shellView.contextSelector.canSelectRestaurant}
      restaurants={shellView.contextSelector.restaurants}
      effectiveRestaurantId={shellView.contextSelector.effectiveRestaurantId}
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
