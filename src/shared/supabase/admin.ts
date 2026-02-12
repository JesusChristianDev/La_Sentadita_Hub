import { createClient } from '@supabase/supabase-js';

import { env } from '@/shared/env';
import { serverEnv } from '@/shared/env.server';

export function createSupabaseAdminClient() {
  return createClient(env.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });
}
