import { redirect } from 'next/navigation';

import { getCurrentUserContext } from '@/modules/auth_users';
import { can } from '@/modules/authz';
import { listMyProcedures, listRestaurantProcedures } from '@/modules/requests/application/procedureService';
import type { ProcedureRecord } from '@/modules/requests/domain/procedureTypes';
import { ProceduresPageClient } from '@/modules/requests/ui/ProceduresPageClient';
import { createSupabaseServerClient } from '@/shared/supabase/server';

export const metadata = {
  title: 'Mis Trámites | La Sentadita Hub',
};

export default async function ProceduresPage() {
  const ctx = await getCurrentUserContext();
  if (!ctx) {
    redirect('/login');
  }

  // Determine current active employment
  const supabase = await createSupabaseServerClient();
  const { data: myEmployments } = await supabase
    .from('employment_relationships')
    .select('employment_id, restaurant_id')
    .eq('person_id', ctx.userId)
    .eq('active_principal', true)
    .single();

  const currentEmploymentId = myEmployments?.employment_id || '';
  const currentRestaurantId = myEmployments?.restaurant_id || '';

  // Get procedures for the user
  const initialProcedures = await listMyProcedures();

  const canManageTeam = can(ctx.requestContext, 'procedures.manage');

  let teamProcedures: ProcedureRecord[] = [];
  try {
    if (canManageTeam && currentRestaurantId) {
      teamProcedures = await listRestaurantProcedures(currentRestaurantId);
    }
  } catch (err) {
    console.error('[ProceduresPage] Error validando tramites de equipo:', err);
  }

  return (
    <main className="app-shell stack rise-in">
      <section className="page-intro">
        <div>
          <h1 className="page-title">Trámites</h1>
          <p className="subtitle">Gestión de solicitudes, vacaciones y licencias.</p>
        </div>
      </section>

      <section className="panel flex-1 flex flex-col min-h-0">
        <div className="flex-1 overflow-auto rounded-lg border border-border/50 bg-background/50">
          <ProceduresPageClient
            initialProcedures={initialProcedures}
            teamProcedures={teamProcedures}
            canManageTeam={canManageTeam}
            currentEmploymentId={currentEmploymentId}
          />
        </div>
      </section>
    </main>
  );
}
