import * as Sentry from '@sentry/nextjs';

import { getEdgeSentryOptions, getServerSentryOptions } from '@/lib/sentry';
import { env } from '@/shared/env';

export async function register() {
  if (!env.sentryDsn) return;

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    Sentry.init(getServerSentryOptions(env.sentryDsn));
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    Sentry.init(getEdgeSentryOptions(env.sentryDsn));
  }
}

export const onRequestError = Sentry.captureRequestError;
