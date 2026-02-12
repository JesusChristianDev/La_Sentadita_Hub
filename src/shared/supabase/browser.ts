import { createBrowserClient } from '@supabase/ssr';

import { env } from '@/shared/env';

export function createSupabaseBrowserClient() {
  return createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
}
