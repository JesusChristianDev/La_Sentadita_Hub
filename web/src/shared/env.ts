import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

const optionalString = z.preprocess(
  (value) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  },
  z.string().min(1).optional(),
);

const optionalUrl = z.preprocess(
  (value) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  },
  z.string().url().optional(),
);

const publicRuntimeEnv = createEnv({
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    NEXT_PUBLIC_SENTRY_DSN: optionalUrl,
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: optionalString,
  },
  runtimeEnv: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  },
});

export const rawEnv = publicRuntimeEnv;

export const env = {
  sentryDsn: publicRuntimeEnv.NEXT_PUBLIC_SENTRY_DSN,
  supabaseAnonKey: publicRuntimeEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  supabaseUrl: publicRuntimeEnv.NEXT_PUBLIC_SUPABASE_URL,
  vapidPublicKey: publicRuntimeEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
};
