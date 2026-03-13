'use client';

import { type ReactNode,useEffect, useState } from 'react';

import { MOBILE_VIEWPORT_MEDIA_QUERY } from '@/shared/responsive';

import { AppHeader, type AppHeaderProps } from './app-header';

type ResponsiveAppFrameProps = AppHeaderProps & {
  children: ReactNode;
  initialIsMobileHint: boolean;
};

export function ResponsiveAppFrame({
  children,
  initialIsMobileHint,
  ...headerProps
}: ResponsiveAppFrameProps) {
  const [isMobileViewport, setIsMobileViewport] = useState(initialIsMobileHint);

  useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_VIEWPORT_MEDIA_QUERY);

    const syncViewport = (matches: boolean) => {
      setIsMobileViewport(matches);
    };

    syncViewport(mediaQuery.matches);

    const onChange = (event: MediaQueryListEvent) => {
      syncViewport(event.matches);
    };

    mediaQuery.addEventListener('change', onChange);
    return () => mediaQuery.removeEventListener('change', onChange);
  }, []);

  return (
    <div
      className="app-runtime"
      data-mobile-device={isMobileViewport ? 'true' : 'false'}
    >
      <AppHeader {...headerProps} isMobileDevice={isMobileViewport} />
      {children}
    </div>
  );
}
