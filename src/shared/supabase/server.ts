import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { env } from '@/shared/env';
import {
  applySessionPersistenceToCookieOptions,
  REMEMBER_SESSION_COOKIE,
  shouldPersistSession,
} from '@/shared/supabase/authCookiePolicy';

type CreateSupabaseServerClientOptions = {
  persistSession?: boolean;
};

export async function createSupabaseServerClient(options?: CreateSupabaseServerClientOptions) {
  const cookieStore = await cookies();
  const persistSession = options?.persistSession ?? shouldPersistSession(cookieStore.get(REMEMBER_SESSION_COOKIE)?.value);

  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          try {
            cookieStore.set(
              name,
              value,
              applySessionPersistenceToCookieOptions(name, options, persistSession),
            );
          } catch {}
        });
      },
    },
  });
}
