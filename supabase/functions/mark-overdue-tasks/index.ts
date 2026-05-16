import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (req: Request) => {
  const authHeader = req.headers.get('Authorization');
  if (authHeader !== `Bearer ${Deno.env.get('CRON_SECRET')}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const now = new Date().toISOString();

  const { error, count } = await supabase
    .from('task_instances')
    .update({ task_status: 'overdue' })
    .in('task_status', ['pending', 'needs_reassignment'])
    .lt('due_at', now)
    .not('due_at', 'is', null)
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error('[mark-overdue-tasks] Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  console.log(`[mark-overdue-tasks] Marked ${count ?? 0} tasks as overdue`);
  return new Response(JSON.stringify({ marked_overdue: count ?? 0 }), { status: 200 });
});
