'use client';

import type {
  HTMLAttributes,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
} from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_DISMISS_GUARD_MS = 320;

type MobileOverlayCloseOptions = {
  armGuard?: boolean;
  restoreFocus?: boolean;
};

type UseMobileOverlayOptions = {
  dismissGuardMs?: number;
  enabled: boolean;
  onOpenChange: (nextOpen: boolean) => void;
  open: boolean;
  restoreFocusRef?: RefObject<HTMLElement | null>;
};

type OverlayEvent =
  | ReactMouseEvent<HTMLDivElement>
  | ReactPointerEvent<HTMLDivElement>;

type UseMobileOverlayResult = {
  backdropProps: Pick<
    HTMLAttributes<HTMLDivElement>,
    | 'onClickCapture'
    | 'onMouseDownCapture'
    | 'onMouseUpCapture'
    | 'onPointerCancelCapture'
    | 'onPointerDownCapture'
    | 'onPointerUpCapture'
  >;
  closeOverlay: (options?: MobileOverlayCloseOptions) => void;
  overlayRef: RefObject<HTMLDivElement | null>;
  panelProps: Pick<HTMLAttributes<HTMLDivElement>, 'onClick' | 'onPointerDown'>;
  prepareToOpen: () => void;
  shouldRenderOverlay: boolean;
};

export function useMobileOverlay({
  dismissGuardMs = DEFAULT_DISMISS_GUARD_MS,
  enabled,
  onOpenChange,
  open,
  restoreFocusRef,
}: UseMobileOverlayOptions): UseMobileOverlayResult {
  const [dismissGuardVisible, setDismissGuardVisible] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const dismissGuardTimerRef = useRef<number | null>(null);
  const focusTriggerAfterCloseRef = useRef(false);
  const backgroundStateRef = useRef<
    Array<{ element: HTMLElement; previousPointerEvents: string; wasInert: boolean }>
  >([]);
  const shouldRenderOverlay = enabled && (open || dismissGuardVisible);

  const restoreBackgroundInteractions = useCallback(() => {
    backgroundStateRef.current.forEach(({ element, previousPointerEvents, wasInert }) => {
      element.inert = wasInert;
      element.style.pointerEvents = previousPointerEvents;
    });
    backgroundStateRef.current = [];

    if (focusTriggerAfterCloseRef.current) {
      focusTriggerAfterCloseRef.current = false;
      restoreFocusRef?.current?.focus();
    }
  }, [restoreFocusRef]);

  const clearDismissGuard = useCallback(() => {
    if (dismissGuardTimerRef.current != null) {
      window.clearTimeout(dismissGuardTimerRef.current);
      dismissGuardTimerRef.current = null;
    }

    setDismissGuardVisible(false);
  }, []);

  const armDismissGuard = useCallback(() => {
    if (dismissGuardTimerRef.current != null) {
      window.clearTimeout(dismissGuardTimerRef.current);
    }

    setDismissGuardVisible(true);
    dismissGuardTimerRef.current = window.setTimeout(() => {
      dismissGuardTimerRef.current = null;
      setDismissGuardVisible(false);
    }, dismissGuardMs);
  }, [dismissGuardMs]);

  const closeOverlay = useCallback(
    ({ armGuard = false, restoreFocus = false }: MobileOverlayCloseOptions = {}) => {
      if (restoreFocus) {
        if (enabled) {
          focusTriggerAfterCloseRef.current = true;
        } else {
          window.requestAnimationFrame(() => {
            restoreFocusRef?.current?.focus();
          });
        }
      }

      if (enabled && armGuard) {
        armDismissGuard();
      }

      onOpenChange(false);
    },
    [armDismissGuard, enabled, onOpenChange, restoreFocusRef],
  );

  const prepareToOpen = useCallback(() => {
    clearDismissGuard();
  }, [clearDismissGuard]);

  const stopOverlayEvent = useCallback((event: OverlayEvent) => {
    event.preventDefault();
    event.stopPropagation();

    const nativeEvent = event.nativeEvent;
    if (
      nativeEvent &&
      'stopImmediatePropagation' in nativeEvent &&
      typeof nativeEvent.stopImmediatePropagation === 'function'
    ) {
      nativeEvent.stopImmediatePropagation();
    }
  }, []);

  const handleBackdropPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      stopOverlayEvent(event);

      if (!open) {
        return;
      }

      closeOverlay({ armGuard: true, restoreFocus: true });
    },
    [closeOverlay, open, stopOverlayEvent],
  );

  useEffect(() => {
    return () => {
      if (dismissGuardTimerRef.current != null) {
        window.clearTimeout(dismissGuardTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!shouldRenderOverlay) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [shouldRenderOverlay]);

  useEffect(() => {
    if (!shouldRenderOverlay) {
      restoreBackgroundInteractions();
      return;
    }

    restoreBackgroundInteractions();

    const overlayRoot = overlayRef.current;
    if (!overlayRoot) {
      return;
    }

    backgroundStateRef.current = Array.from(document.body.children)
      .filter(
        (element): element is HTMLElement =>
          element instanceof HTMLElement && element !== overlayRoot,
      )
      .map((element) => ({
        element,
        previousPointerEvents: element.style.pointerEvents,
        wasInert: element.inert,
      }));

    backgroundStateRef.current.forEach(({ element }) => {
      element.inert = true;
      element.style.pointerEvents = 'none';
    });

    return restoreBackgroundInteractions;
  }, [restoreBackgroundInteractions, shouldRenderOverlay]);

  useEffect(() => {
    return () => {
      restoreBackgroundInteractions();
    };
  }, [restoreBackgroundInteractions]);

  return {
    backdropProps: {
      onClickCapture: stopOverlayEvent,
      onMouseDownCapture: stopOverlayEvent,
      onMouseUpCapture: stopOverlayEvent,
      onPointerCancelCapture: stopOverlayEvent,
      onPointerDownCapture: handleBackdropPointerDown,
      onPointerUpCapture: stopOverlayEvent,
    },
    closeOverlay,
    overlayRef,
    panelProps: {
      onClick: (event) => {
        event.stopPropagation();
      },
      onPointerDown: (event) => {
        event.stopPropagation();
      },
    },
    prepareToOpen,
    shouldRenderOverlay,
  };
}
