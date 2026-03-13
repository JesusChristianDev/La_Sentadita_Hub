export const MOBILE_VIEWPORT_MEDIA_QUERY = '(max-width: 1023px)';

export function matchesMobileViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(MOBILE_VIEWPORT_MEDIA_QUERY).matches;
}
