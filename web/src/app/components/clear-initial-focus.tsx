'use client';

import { useEffect } from 'react';

export function ClearInitialFocus() {
  useEffect(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement && active !== document.body) {
      active.blur();
    }
  }, []);

  return null;
}
