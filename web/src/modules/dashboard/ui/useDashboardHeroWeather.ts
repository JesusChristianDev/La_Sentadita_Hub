'use client';

import { useEffect, useRef, useState } from 'react';

import {
  getCurrentCoordinates,
  resolveDashboardLocationFallback,
  reverseGeocodeDashboardCoordinates,
} from './dashboardHeroLocation';
import {
  buildPartialWeatherMessage,
  type DashboardWeatherState,
} from './dashboardHeroModels';
import { fetchDashboardHeroWeather } from './dashboardHeroWeatherData';

function isGeolocationError(error: unknown): error is GeolocationPositionError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'number'
  );
}

function resolveWeatherErrorMessage(error: unknown) {
  if (isGeolocationError(error)) {
    if (error.code === error.PERMISSION_DENIED) {
      return 'Activa la ubicacion para integrar el clima en este widget.';
    }

    if (error.code === error.TIMEOUT) {
      return 'No pudimos leer tu ubicacion a tiempo. Reintenta.';
    }

    return 'No pudimos resolver tu ubicacion ahora mismo.';
  }

  return 'No pudimos completar el clima en este momento.';
}

export function useDashboardHeroWeather() {
  const [weather, setWeather] = useState<DashboardWeatherState>({ status: 'idle' });
  const abortControllerRef = useRef<AbortController | null>(null);
  const hasRequestedWeatherRef = useRef(false);
  const requestSequenceRef = useRef(0);
  const requestWeatherRef = useRef<() => Promise<void>>(async () => {});

  requestWeatherRef.current = async () => {
    if (!('geolocation' in navigator)) {
      setWeather({
        message: 'El navegador no permite mostrar el clima.',
        status: 'error',
      });
      return;
    }

    const requestId = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestId;

    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setWeather({ status: 'loading' });

    try {
      const coordinates = await getCurrentCoordinates();
      const [weatherResult, locationResult] = await Promise.allSettled([
        fetchDashboardHeroWeather(coordinates, abortController.signal),
        reverseGeocodeDashboardCoordinates(coordinates, abortController.signal),
      ]);

      if (requestSequenceRef.current !== requestId) {
        return;
      }

      if (weatherResult.status === 'rejected') {
        throw weatherResult.reason;
      }

      const location =
        locationResult.status === 'fulfilled'
          ? locationResult.value
          : resolveDashboardLocationFallback();
      const nextWeather = {
        ...weatherResult.value,
        locationLabel: location.label,
        locationSource: location.source,
      };
      const isDailyRangeMissing =
        nextWeather.high === null || nextWeather.low === null;
      const hasFallbackLocation = location.source === 'fallback';

      setWeather(
        isDailyRangeMissing || hasFallbackLocation
          ? {
              data: nextWeather,
              message: buildPartialWeatherMessage({
                hasFallbackLocation,
                isDailyRangeMissing,
              }),
              status: 'partial',
            }
          : {
              data: nextWeather,
              status: 'success',
            },
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }

      if (requestSequenceRef.current !== requestId) {
        return;
      }

      setWeather({
        message: resolveWeatherErrorMessage(error),
        status: 'error',
      });
    }
  };

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setWeather({
        message: 'El navegador no permite mostrar el clima.',
        status: 'error',
      });
      return;
    }

    let permissionStatus: PermissionStatus | null = null;
    let isActive = true;

    const syncPermission = async () => {
      if (!navigator.permissions?.query) {
        return;
      }

      try {
        permissionStatus = await navigator.permissions.query({
          name: 'geolocation' as PermissionName,
        });

        if (!isActive) {
          return;
        }

        const refreshFromPermission = () => {
          if (!permissionStatus || !isActive) {
            return;
          }

          if (permissionStatus.state === 'granted') {
            if (!hasRequestedWeatherRef.current) {
              hasRequestedWeatherRef.current = true;
            }

            void requestWeatherRef.current();
            return;
          }

          if (permissionStatus.state === 'denied') {
            setWeather({
              message: 'La ubicacion esta bloqueada para el clima.',
              status: 'error',
            });
            return;
          }

          setWeather({ status: 'idle' });
        };

        refreshFromPermission();
        permissionStatus.onchange = refreshFromPermission;
      } catch {
        setWeather((currentWeather) =>
          currentWeather.status === 'loading' ? { status: 'idle' } : currentWeather,
        );
      }
    };

    void syncPermission();

    return () => {
      isActive = false;
      requestSequenceRef.current += 1;
      abortControllerRef.current?.abort();

      if (permissionStatus) {
        permissionStatus.onchange = null;
      }
    };
  }, []);

  return {
    requestWeather: () => {
      hasRequestedWeatherRef.current = true;
      void requestWeatherRef.current();
    },
    weather,
  };
}
