'use client';

import {
  Cloud,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  LoaderCircle,
  MoonStar,
  SunMedium,
  Wind,
} from 'lucide-react';
import {
  type ComponentType,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from 'react';

type DashboardPersonalizedMessagesProps = {
  canPickRestaurant: boolean;
  effectiveRestaurantName: string;
  hasEffectiveRestaurant: boolean;
  userName: string;
};

type TimeBlock = 'morning' | 'afternoon' | 'night';
type WeatherIconName =
  | 'sun'
  | 'moon'
  | 'cloud-sun'
  | 'cloud'
  | 'rain'
  | 'snow'
  | 'storm'
  | 'wind';

type WeatherWidgetState =
  | { status: 'idle' }
  | { status: 'loading' }
  | {
      conditionLabel: string;
      status: 'ready';
      temperature: number;
      weatherIcon: WeatherIconName;
      windSpeed: number;
    }
  | { message: string; status: 'unavailable' };

type OpenMeteoResponse = {
  current?: {
    is_day?: number;
    temperature_2m?: number;
    weather_code?: number;
    wind_speed_10m?: number;
  };
};

function getFirstName(userName: string) {
  const firstName = userName.trim().split(/\s+/)[0];
  return firstName || 'equipo';
}

function getTimeBlock(hour: number): TimeBlock {
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 20) return 'afternoon';
  return 'night';
}

function getGreeting(timeBlock: TimeBlock) {
  if (timeBlock === 'morning') return 'Buenos dias';
  if (timeBlock === 'afternoon') return 'Buenas tardes';
  return 'Buenas noches';
}

function getTimeMessage(timeBlock: TimeBlock) {
  if (timeBlock === 'morning') {
    return 'Todo listo para empezar.';
  }

  if (timeBlock === 'afternoon') {
    return 'Tu jornada sigue en marcha.';
  }

  return 'Buen momento para cerrar el dia.';
}

function resolveWeatherVisual(weatherCode: number, isDay: boolean, windSpeed: number) {
  if (windSpeed >= 35 && weatherCode <= 3) {
    return { conditionLabel: 'Viento', weatherIcon: 'wind' as const };
  }

  if (weatherCode === 0) {
    return {
      conditionLabel: isDay ? 'Soleado' : 'Despejado',
      weatherIcon: isDay ? ('sun' as const) : ('moon' as const),
    };
  }

  if (weatherCode === 1 || weatherCode === 2) {
    return { conditionLabel: 'Parcialmente nublado', weatherIcon: 'cloud-sun' as const };
  }

  if (weatherCode === 3) {
    return { conditionLabel: 'Nublado', weatherIcon: 'cloud' as const };
  }

  if (weatherCode === 45 || weatherCode === 48) {
    return { conditionLabel: 'Niebla', weatherIcon: 'wind' as const };
  }

  if (
    weatherCode === 51 ||
    weatherCode === 53 ||
    weatherCode === 55 ||
    weatherCode === 56 ||
    weatherCode === 57 ||
    weatherCode === 61 ||
    weatherCode === 63 ||
    weatherCode === 65 ||
    weatherCode === 66 ||
    weatherCode === 67 ||
    weatherCode === 80 ||
    weatherCode === 81 ||
    weatherCode === 82
  ) {
    return { conditionLabel: 'Lluvia', weatherIcon: 'rain' as const };
  }

  if (
    weatherCode === 71 ||
    weatherCode === 73 ||
    weatherCode === 75 ||
    weatherCode === 77 ||
    weatherCode === 85 ||
    weatherCode === 86
  ) {
    return { conditionLabel: 'Nieve', weatherIcon: 'snow' as const };
  }

  if (weatherCode === 95 || weatherCode === 96 || weatherCode === 99) {
    return { conditionLabel: 'Tormenta', weatherIcon: 'storm' as const };
  }

  return { conditionLabel: 'Variable', weatherIcon: 'cloud' as const };
}

function getWeatherIcon(weatherIcon: WeatherIconName): ComponentType<{ className?: string }> {
  if (weatherIcon === 'sun') return SunMedium;
  if (weatherIcon === 'moon') return MoonStar;
  if (weatherIcon === 'cloud-sun') return CloudSun;
  if (weatherIcon === 'rain') return CloudRain;
  if (weatherIcon === 'snow') return CloudSnow;
  if (weatherIcon === 'storm') return CloudLightning;
  if (weatherIcon === 'wind') return Wind;
  return Cloud;
}

export function DashboardPersonalizedMessages(
  props: DashboardPersonalizedMessagesProps,
) {
  const [now, setNow] = useState<Date | null>(null);
  const [weather, setWeather] = useState<WeatherWidgetState>({ status: 'idle' });
  const hasRequestedWeatherRef = useRef(false);

  useEffect(() => {
    const updateNow = () => {
      setNow(new Date());
    };

    updateNow();
    const intervalId = window.setInterval(updateNow, 60_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const requestWeather = async () => {
    if (!('geolocation' in navigator)) {
      setWeather({
        status: 'unavailable',
        message: 'El navegador no permite mostrar el clima.',
      });
      return;
    }

    setWeather({ status: 'loading' });

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          maximumAge: 15 * 60_000,
          timeout: 8_000,
        });
      });

      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${position.coords.latitude}&longitude=${position.coords.longitude}&current=temperature_2m,weather_code,is_day,wind_speed_10m&temperature_unit=celsius&wind_speed_unit=kmh&timezone=auto`,
        { cache: 'no-store' },
      );

      if (!response.ok) {
        throw new Error('weather_fetch_failed');
      }

      const payload = (await response.json()) as OpenMeteoResponse;
      const current = payload.current;

      if (
        typeof current?.temperature_2m !== 'number' ||
        typeof current.weather_code !== 'number' ||
        typeof current.is_day !== 'number' ||
        typeof current.wind_speed_10m !== 'number'
      ) {
        throw new Error('weather_payload_invalid');
      }

      const visual = resolveWeatherVisual(
        current.weather_code,
        current.is_day === 1,
        current.wind_speed_10m,
      );

      setWeather({
        status: 'ready',
        conditionLabel: visual.conditionLabel,
        temperature: Math.round(current.temperature_2m),
        weatherIcon: visual.weatherIcon,
        windSpeed: Math.round(current.wind_speed_10m),
      });
    } catch {
      setWeather({
        status: 'unavailable',
        message: 'Activa la ubicacion si quieres ver el clima.',
      });
    }
  };

  const loadWeatherFromEffect = useEffectEvent(() => {
    void requestWeather();
  });

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setWeather({
        status: 'unavailable',
        message: 'El navegador no permite mostrar el clima.',
      });
      return;
    }

    let permissionStatus: PermissionStatus | null = null;
    let cancelled = false;

    const syncPermission = async () => {
      if (!navigator.permissions?.query) {
        return;
      }

      try {
        permissionStatus = await navigator.permissions.query({
          name: 'geolocation' as PermissionName,
        });

        if (cancelled) {
          return;
        }

        if (permissionStatus.state === 'granted') {
          if (!hasRequestedWeatherRef.current) {
            hasRequestedWeatherRef.current = true;
            loadWeatherFromEffect();
          }

          permissionStatus.onchange = () => {
            if (permissionStatus?.state === 'granted') {
              loadWeatherFromEffect();
            }
          };
          return;
        }

        if (permissionStatus.state === 'prompt') {
          setWeather({ status: 'idle' });
          permissionStatus.onchange = () => {
            if (permissionStatus?.state === 'granted') {
              loadWeatherFromEffect();
            }
          };
          return;
        }

        if (permissionStatus.state === 'denied') {
          setWeather({
            status: 'unavailable',
            message: 'La ubicacion esta bloqueada para el clima.',
          });
          permissionStatus.onchange = () => {
            if (permissionStatus?.state === 'granted') {
              loadWeatherFromEffect();
            }
          };
        }
      } catch {
        setWeather({ status: 'idle' });
      }
    };

    void syncPermission();

    return () => {
      cancelled = true;
      if (permissionStatus) {
        permissionStatus.onchange = null;
      }
    };
  }, []);

  const timeBlock = now ? getTimeBlock(now.getHours()) : 'morning';
  const greeting = now ? getGreeting(timeBlock) : 'Hola';
  const firstName = getFirstName(props.userName);
  const restaurantMessage =
    props.canPickRestaurant && !props.hasEffectiveRestaurant
      ? 'Selecciona una sucursal en el header para continuar.'
      : props.effectiveRestaurantName;
  const WeatherIcon =
    weather.status === 'ready' ? getWeatherIcon(weather.weatherIcon) : LoaderCircle;
  const weatherSummary =
    weather.status === 'ready'
      ? `${weather.conditionLabel} · ${weather.temperature}\u00b0`
      : weather.status === 'loading'
        ? 'Consultando clima...'
        : weather.status === 'unavailable'
          ? weather.message
          : 'Preparando clima...';

  return (
    <section className="panel">
      <h2 className="panel-title">Mensajes para ti</h2>

      <div className="dashboard-message-hero">
        <div className="dashboard-message-copy">
          <h3 className="dashboard-message-title">{`${greeting}, ${firstName}.`}</h3>
          <p className="dashboard-message-body">{getTimeMessage(timeBlock)}</p>

          <div className="dashboard-message-meta">
            <div
              className="dashboard-weather-inline"
              data-status={weather.status}
              aria-live="polite"
            >
              <span className="dashboard-weather-icon" aria-hidden="true">
                <WeatherIcon
                  className={
                    weather.status === 'loading'
                      ? 'dashboard-weather-icon-glyph is-spinning'
                      : 'dashboard-weather-icon-glyph'
                  }
                />
              </span>

              <div className="dashboard-weather-copy">
                <p className="dashboard-weather-label">Clima</p>
                <p className="dashboard-weather-summary">{weatherSummary}</p>
              </div>

              {weather.status === 'ready' ? (
                <p className="dashboard-weather-detail">{`${weather.windSpeed} km/h`}</p>
              ) : weather.status === 'idle' ? (
                <button
                  type="button"
                  className="dashboard-weather-cta"
                  onClick={() => {
                    hasRequestedWeatherRef.current = true;
                    void requestWeather();
                  }}
                >
                  Activar clima
                </button>
              ) : weather.status === 'unavailable' ? (
                <button
                  type="button"
                  className="dashboard-weather-cta"
                  onClick={() => {
                    void requestWeather();
                  }}
                >
                  Reintentar
                </button>
              ) : null}
            </div>

            <p className="dashboard-message-context">{restaurantMessage}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
