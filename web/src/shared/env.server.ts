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

const optionalNonNegativeInt = z.preprocess(
  (value) => {
    if (value === undefined || value === null) return undefined;
    if (typeof value === 'string' && value.trim() === '') return undefined;
    return value;
  },
  z.coerce.number().int().min(0).optional(),
);

const optionalBinaryFlag = z.preprocess(
  (value) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  },
  z.enum(['0', '1']).optional(),
);

const serverRuntimeEnv = createEnv({
  server: {
    ALLOW_UI_PREVIEW: optionalBinaryFlag,
    E2E_LOGIN_DELAY_MS: optionalNonNegativeInt,
    MINDEE_API_KEY: optionalString,
    RESEND_API_KEY: optionalString,
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    VAPID_PRIVATE_KEY: optionalString,
    VAPID_SUBJECT: optionalString,
  },
  experimental__runtimeEnv: process.env,
});

export const rawServerEnv = serverRuntimeEnv;

export const serverEnv = {
  allowUiPreview: serverRuntimeEnv.ALLOW_UI_PREVIEW === '1',
  e2eLoginDelayMs: serverRuntimeEnv.E2E_LOGIN_DELAY_MS ?? 0,
  mindeeApiKey: serverRuntimeEnv.MINDEE_API_KEY,
  resendApiKey: serverRuntimeEnv.RESEND_API_KEY,
  supabaseServiceRoleKey: serverRuntimeEnv.SUPABASE_SERVICE_ROLE_KEY,
  vapidPrivateKey: serverRuntimeEnv.VAPID_PRIVATE_KEY,
  vapidSubject: serverRuntimeEnv.VAPID_SUBJECT,
};
