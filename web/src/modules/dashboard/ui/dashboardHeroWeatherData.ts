import { type DashboardCoordinates } from './dashboardHeroLocation';
import {
  type DashboardWeatherData,
  resolveWeatherDescriptor,
} from './dashboardHeroModels';

type OpenMeteoResponse = {
  current?: {
    is_day?: number;
    temperature_2m?: number;
    weather_code?: number;
    wind_speed_10m?: number;
  };
  daily?: {
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
  };
};

export type DashboardWeatherSnapshot = Omit<
  DashboardWeatherData,
  'locationLabel' | 'locationSource'
>;

function buildWeatherUrl(coordinates: DashboardCoordinates) {
  const params = new URLSearchParams({
    current: 'temperature_2m,weather_code,is_day,wind_speed_10m',
    daily: 'temperature_2m_max,temperature_2m_min',
    forecast_days: '1',
    latitude: String(coordinates.latitude),
    longitude: String(coordinates.longitude),
    temperature_unit: 'celsius',
    timezone: 'auto',
    wind_speed_unit: 'kmh',
  });

  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
}

function mapWeatherPayload(payload: OpenMeteoResponse): DashboardWeatherSnapshot | null {
  const current = payload.current;
  if (
    typeof current?.temperature_2m !== 'number' ||
    typeof current.weather_code !== 'number' ||
    typeof current.is_day !== 'number'
  ) {
    return null;
  }

  const windSpeed =
    typeof current.wind_speed_10m === 'number' ? Math.round(current.wind_speed_10m) : null;
  const visual = resolveWeatherDescriptor(
    current.weather_code,
    current.is_day === 1,
    windSpeed,
  );
  const max = payload.daily?.temperature_2m_max?.[0];
  const min = payload.daily?.temperature_2m_min?.[0];

  return {
    conditionLabel: visual.conditionLabel,
    high: typeof max === 'number' ? Math.round(max) : null,
    iconName: visual.iconName,
    low: typeof min === 'number' ? Math.round(min) : null,
    temperature: Math.round(current.temperature_2m),
    tone: visual.tone,
    windSpeed,
  };
}

export async function fetchDashboardHeroWeather(
  coordinates: DashboardCoordinates,
  signal: AbortSignal,
) {
  const response = await fetch(buildWeatherUrl(coordinates), {
    cache: 'no-store',
    signal,
  });

  if (!response.ok) {
    throw new Error('weather_fetch_failed');
  }

  const payload = (await response.json()) as OpenMeteoResponse;
  const weatherSnapshot = mapWeatherPayload(payload);

  if (!weatherSnapshot) {
    throw new Error('weather_payload_invalid');
  }

  return weatherSnapshot;
}
