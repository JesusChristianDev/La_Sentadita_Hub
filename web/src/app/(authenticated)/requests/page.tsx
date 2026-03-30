import { redirect } from 'next/navigation';

import { getCurrentUserContext } from '@/modules/auth_users';
import { can } from '@/modules/authz';
import { listMyRequests, listRestaurantRequests } from '@/modules/requests/application/requestService';
import type { RequestRecord } from '@/modules/requests/domain/requestTypes';
import { RequestsPageClient } from '@/modules/requests/ui/RequestsPageClient';
import { createSupabaseServerClient } from '@/shared/supabase/server';

export const metadata = {
  title: 'Mis Solicitudes | La Sentadita Hub',
};

export default async function RequestsPage() {
  const ctx = await getCurrentUserContext();
  if (!ctx) {
    redirect('/login');
  }

  const supabase = await createSupabaseServerClient();
  const { data: myEmployments } = await supabase
    .from('employment_relationships')
    .select('employment_id, restaurant_id')
    .eq('person_id', ctx.userId)
    .eq('active_principal', true)
    .single();

  const currentEmploymentId = myEmployments?.employment_id || '';
  const currentRestaurantId = myEmployments?.restaurant_id || '';
  const initialRequests = await listMyRequests();
  const canManageTeam = can(ctx.requestContext, 'requests.manage');

  let teamRequests: RequestRecord[] = [];
  try {
    if (canManageTeam && currentRestaurantId) {
      teamRequests = await listRestaurantRequests(currentRestaurantId);
    }
  } catch (error) {
    console.error('[RequestsPage] Error validando solicitudes de equipo:', error);
  }

  return (
    <main className="app-shell stack rise-in">
      <section className="page-intro">
        <div>
          <h1 className="page-title">Solicitudes</h1>
          <p className="subtitle">Gestion de solicitudes laborales y operativas.</p>
        </div>
      </section>

      <section className="panel flex min-h-0 flex-1 flex-col">
        <div className="flex-1 overflow-auto rounded-lg border border-border/50 bg-background/50">
          <RequestsPageClient
            initialRequests={initialRequests}
            teamRequests={teamRequests}
            canManageTeam={canManageTeam}
            currentEmploymentId={currentEmploymentId}
          />
        </div>
      </section>
    </main>
  );
}
