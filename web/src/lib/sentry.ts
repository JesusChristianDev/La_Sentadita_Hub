import type { BrowserOptions, EdgeOptions, NodeOptions } from '@sentry/nextjs';

type SharedSentryOptions = {
  dsn: string;
  enabled: boolean;
  environment: string;
  release?: string;
  sendDefaultPii: false;
  tracesSampleRate: number;
};

function buildSharedSentryOptions(dsn: string): SharedSentryOptions {
  return {
    dsn,
    enabled: Boolean(dsn),
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',
    ...(process.env.VERCEL_GIT_COMMIT_SHA
      ? { release: process.env.VERCEL_GIT_COMMIT_SHA }
      : {}),
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
  };
}

export function getClientSentryOptions(dsn: string): BrowserOptions {
  return buildSharedSentryOptions(dsn);
}

export function getEdgeSentryOptions(dsn: string): EdgeOptions {
  return buildSharedSentryOptions(dsn);
}

export function getServerSentryOptions(dsn: string): NodeOptions {
  return buildSharedSentryOptions(dsn);
}
