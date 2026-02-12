'use client';

import { useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

declare global {
  interface Window {
    promptPwaInstall?: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
  }
}

export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
    let isReloadingFromNewWorker = false;

    const onBeforeInstallPrompt = (event: Event) => {
      const installEvent = event as BeforeInstallPromptEvent;
      installEvent.preventDefault();
      deferredInstallPrompt = installEvent;
      window.dispatchEvent(new CustomEvent('pwa:install-available', { detail: { available: true } }));
    };

    const onAppInstalled = () => {
      deferredInstallPrompt = null;
      window.dispatchEvent(new CustomEvent('pwa:install-available', { detail: { available: false } }));
    };

    const onControllerChange = () => {
      if (isReloadingFromNewWorker) return;
      isReloadingFromNewWorker = true;
      window.location.reload();
    };

    window.promptPwaInstall = async () => {
      if (!deferredInstallPrompt) return 'unavailable';
      await deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        deferredInstallPrompt = null;
      }
      return choice.outcome;
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        });
        await registration.update();
      } catch (error) {
        console.error('Service worker registration failed', error);
      }
    };

    void register();

    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      void navigator.serviceWorker.getRegistration('/').then((registration) => registration?.update());
    };

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      delete window.promptPwaInstall;
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  return null;
}
