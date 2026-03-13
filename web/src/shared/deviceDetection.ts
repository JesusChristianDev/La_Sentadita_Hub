import { headers } from 'next/headers';

const MOBILE_UA_PATTERN =
  /Android.+Mobile|iPhone|iPod|Windows Phone|webOS|BlackBerry|Opera Mini|IEMobile/i;

function normalizeHint(value: string | null): boolean | null {
  if (value === '?1') return true;
  if (value === '?0') return false;
  return null;
}

export function isMobileDeviceUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  return MOBILE_UA_PATTERN.test(userAgent);
}

export async function getIsMobileDevice(): Promise<boolean> {
  const requestHeaders = await headers();
  const mobileHint = normalizeHint(requestHeaders.get('sec-ch-ua-mobile'));
  if (mobileHint !== null) return mobileHint;

  return isMobileDeviceUserAgent(requestHeaders.get('user-agent'));
}
