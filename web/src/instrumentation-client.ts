import * as Sentry from '@sentry/nextjs';

import { getClientSentryOptions } from '@/lib/sentry';
import { env } from '@/shared/env';

if (env.sentryDsn) {
  Sentry.init(getClientSentryOptions(env.sentryDsn));
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
