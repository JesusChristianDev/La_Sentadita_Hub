import { createClient } from 'jsr:@supabase/supabase-js@2';

// Incidents that stay in 'reported' for more than 3 days are escalated to 'in_review'.
// Incidents that stay in 'in_review' for more than 14 days are auto-closed.
const ESCALATE_REPORTED_DAYS = 3;
const AUTO_CLOSE_IN_REVIEW_DAYS = 14;

Deno.serve(async (req: Request) => {
  const authHeader = req.headers.get('Authorization');
  if (authHeader !== `Bearer ${Deno.env.get('CRON_SECRET')}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const escalateCutoff = new Date(
    Date.now() - ESCALATE_REPORTED_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const closeCutoff = new Date(
    Date.now() - AUTO_CLOSE_IN_REVIEW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const [escalateResult, closeResult] = await Promise.all([
    supabase
      .from('incidents')
      .update({ status: 'in_review' })
      .eq('status', 'reported')
      .lt('created_at', escalateCutoff)
      .select('*', { count: 'exact', head: true }),
    supabase
      .from('incidents')
      .update({ status: 'closed' })
      .eq('status', 'in_review')
      .lt('updated_at', closeCutoff)
      .select('*', { count: 'exact', head: true }),
  ]);

  if (escalateResult.error) {
    console.error('[escalate-stale-incidents] Escalate error:', escalateResult.error.message);
    return new Response(JSON.stringify({ error: escalateResult.error.message }), { status: 500 });
  }

  if (closeResult.error) {
    console.error('[escalate-stale-incidents] Close error:', closeResult.error.message);
    return new Response(JSON.stringify({ error: closeResult.error.message }), { status: 500 });
  }

  const result = {
    escalated_to_in_review: escalateResult.count ?? 0,
    auto_closed: closeResult.count ?? 0,
  };
  console.log('[escalate-stale-incidents]', result);
  return new Response(JSON.stringify(result), { status: 200 });
});
