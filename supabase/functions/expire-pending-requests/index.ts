import { createClient } from 'jsr:@supabase/supabase-js@2';

const EXPIRY_DAYS = 30;

Deno.serve(async (req: Request) => {
  const authHeader = req.headers.get('Authorization');
  if (authHeader !== `Bearer ${Deno.env.get('CRON_SECRET')}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const cutoff = new Date(Date.now() - EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { error, count } = await supabase
    .from('requests')
    .update({ status: 'expired' })
    .in('status', ['pending', 'in_review'])
    .lt('created_at', cutoff)
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error('[expire-pending-requests] Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  console.log(`[expire-pending-requests] Expired ${count ?? 0} requests`);
  return new Response(JSON.stringify({ expired: count ?? 0 }), { status: 200 });
});
