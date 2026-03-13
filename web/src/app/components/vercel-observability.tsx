'use client';

import dynamic from 'next/dynamic';

const Analytics = dynamic(
  () => import('@vercel/analytics/next').then((mod) => mod.Analytics),
  { ssr: false },
);

const SpeedInsights = dynamic(
  () => import('@vercel/speed-insights/next').then((mod) => mod.SpeedInsights),
  { ssr: false },
);

function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.pathname;
  } catch {
    return url.split('?')[0]?.split('#')[0] ?? url;
  }
}

export function VercelObservability() {
  if (process.env.NODE_ENV !== 'production') return null;

  return (
    <>
      <Analytics beforeSend={(event) => ({ ...event, url: sanitizeUrl(event.url) })} />
      <SpeedInsights beforeSend={(event) => ({ ...event, url: sanitizeUrl(event.url) })} />
    </>
  );
}
