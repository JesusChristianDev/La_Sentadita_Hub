'use client';

import { useEffect, useState } from 'react';

type InstallAvailabilityDetail = {
  available?: boolean;
};

function isStandaloneMode() {
  if (typeof window === 'undefined') return false;
  const iosStandalone = Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
  const displayModeStandalone = window.matchMedia('(display-mode: standalone)').matches;
  return iosStandalone || displayModeStandalone;
}

export function InstallPwaButton() {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (isStandaloneMode()) {
      return;
    }

    const onInstallAvailable = (event: Event) => {
      const customEvent = event as CustomEvent<InstallAvailabilityDetail>;
      setAvailable(Boolean(customEvent.detail?.available));
    };

    window.addEventListener('pwa:install-available', onInstallAvailable);
    return () => {
      window.removeEventListener('pwa:install-available', onInstallAvailable);
    };
  }, []);

  const onInstall = async () => {
    const result = await window.promptPwaInstall?.();
    if (result === 'accepted' || result === 'unavailable') {
      setAvailable(false);
    }
  };

  if (!available) return null;

  return (
    <button type="button" className="install-pwa-button" onClick={() => void onInstall()}>
      Instalar app
    </button>
  );
}
