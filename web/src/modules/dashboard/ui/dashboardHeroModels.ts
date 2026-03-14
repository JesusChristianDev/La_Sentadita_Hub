import {
  Cloud,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  MoonStar,
  SunMedium,
  Wind,
} from 'lucide-react';
import { type ComponentType,createElement } from 'react';

export type DashboardHeroTimeBlock = 'morning' | 'afternoon' | 'night';

export type DashboardHeroVisualTone =
  | DashboardHeroTimeBlock
  | 'clear'
  | 'partly-cloudy'
  | 'cloudy'
  | 'rain'
  | 'snow'
  | 'storm'
  | 'wind';

export type DashboardWeatherIconName =
  | 'sun'
  | 'moon'
  | 'cloud-sun'
  | 'cloud'
  | 'rain'
  | 'snow'
  | 'storm'
  | 'wind';

export type DashboardWeatherData = {
  conditionLabel: string;
  high: number | null;
  iconName: DashboardWeatherIconName;
  locationLabel: string;
  locationSource: 'fallback' | 'reverse-geocode';
  low: number | null;
  temperature: number;
  tone: DashboardHeroVisualTone;
  windSpeed: number | null;
};

export type DashboardWeatherState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { message: string; status: 'error' }
  | {
      data: DashboardWeatherData;
      message?: string;
      status: 'partial' | 'success';
    };

export type DashboardHeroWidgetProps = {
  canPickRestaurant: boolean;
  effectiveRestaurantName: string;
  hasEffectiveRestaurant: boolean;
  userName: string;
};

type DashboardHeroVisual = {
  backdropClassName: string;
  glowClassName: string;
  iconClassName: string;
  orbClassName: string;
  overlayClassName: string;
  ringClassName: string;
};

type HeroCopyParams = {
  operationalLabel: string;
  timeBlock: DashboardHeroTimeBlock;
  weather: DashboardWeatherState;
};

type SupportingNoteParams = HeroCopyParams & {
  needsRestaurantSelection: boolean;
};

const heroVisuals: Record<DashboardHeroVisualTone, DashboardHeroVisual> = {
  morning: {
    backdropClassName:
      'bg-[linear-gradient(135deg,rgba(52,23,8,0.96)_0%,rgba(19,25,42,0.94)_48%,rgba(9,9,11,1)_100%)]',
    glowClassName: 'bg-amber-300/18',
    iconClassName: 'text-amber-100/90',
    orbClassName:
      'bg-[radial-gradient(circle_at_18%_18%,rgba(251,191,36,0.22),transparent_30%),radial-gradient(circle_at_82%_14%,rgba(56,189,248,0.18),transparent_26%),radial-gradient(circle_at_70%_78%,rgba(180,83,9,0.16),transparent_24%)]',
    overlayClassName:
      'bg-[linear-gradient(180deg,rgba(9,9,11,0.06)_0%,rgba(9,9,11,0.32)_46%,rgba(9,9,11,0.72)_100%)]',
    ringClassName: 'border-white/12',
  },
  afternoon: {
    backdropClassName:
      'bg-[linear-gradient(135deg,rgba(49,20,12,0.96)_0%,rgba(31,24,38,0.94)_52%,rgba(9,9,11,1)_100%)]',
    glowClassName: 'bg-orange-300/16',
    iconClassName: 'text-orange-100/86',
    orbClassName:
      'bg-[radial-gradient(circle_at_16%_16%,rgba(249,115,22,0.18),transparent_28%),radial-gradient(circle_at_88%_18%,rgba(251,191,36,0.14),transparent_24%),radial-gradient(circle_at_72%_80%,rgba(14,165,233,0.14),transparent_24%)]',
    overlayClassName:
      'bg-[linear-gradient(180deg,rgba(9,9,11,0.1)_0%,rgba(9,9,11,0.34)_42%,rgba(9,9,11,0.72)_100%)]',
    ringClassName: 'border-white/10',
  },
  night: {
    backdropClassName:
      'bg-[linear-gradient(135deg,rgba(13,23,42,0.98)_0%,rgba(20,20,30,0.96)_46%,rgba(9,9,11,1)_100%)]',
    glowClassName: 'bg-sky-300/14',
    iconClassName: 'text-sky-100/82',
    orbClassName:
      'bg-[radial-gradient(circle_at_18%_14%,rgba(59,130,246,0.16),transparent_28%),radial-gradient(circle_at_84%_12%,rgba(148,163,184,0.16),transparent_26%),radial-gradient(circle_at_68%_78%,rgba(37,99,235,0.12),transparent_24%)]',
    overlayClassName:
      'bg-[linear-gradient(180deg,rgba(9,9,11,0.08)_0%,rgba(9,9,11,0.36)_44%,rgba(9,9,11,0.78)_100%)]',
    ringClassName: 'border-white/10',
  },
  clear: {
    backdropClassName:
      'bg-[linear-gradient(135deg,rgba(55,24,6,0.98)_0%,rgba(18,31,48,0.94)_48%,rgba(9,9,11,1)_100%)]',
    glowClassName: 'bg-amber-300/20',
    iconClassName: 'text-amber-100/92',
    orbClassName:
      'bg-[radial-gradient(circle_at_18%_18%,rgba(251,191,36,0.24),transparent_30%),radial-gradient(circle_at_84%_16%,rgba(125,211,252,0.2),transparent_26%),radial-gradient(circle_at_72%_80%,rgba(245,158,11,0.16),transparent_24%)]',
    overlayClassName:
      'bg-[linear-gradient(180deg,rgba(9,9,11,0.04)_0%,rgba(9,9,11,0.3)_46%,rgba(9,9,11,0.7)_100%)]',
    ringClassName: 'border-white/12',
  },
  'partly-cloudy': {
    backdropClassName:
      'bg-[linear-gradient(135deg,rgba(33,28,20,0.98)_0%,rgba(20,27,36,0.95)_52%,rgba(9,9,11,1)_100%)]',
    glowClassName: 'bg-slate-300/14',
    iconClassName: 'text-white/78',
    orbClassName:
      'bg-[radial-gradient(circle_at_18%_18%,rgba(251,191,36,0.16),transparent_28%),radial-gradient(circle_at_82%_18%,rgba(148,163,184,0.18),transparent_26%),radial-gradient(circle_at_70%_82%,rgba(56,189,248,0.12),transparent_22%)]',
    overlayClassName:
      'bg-[linear-gradient(180deg,rgba(9,9,11,0.08)_0%,rgba(9,9,11,0.34)_44%,rgba(9,9,11,0.74)_100%)]',
    ringClassName: 'border-white/10',
  },
  cloudy: {
    backdropClassName:
      'bg-[linear-gradient(135deg,rgba(26,26,31,0.98)_0%,rgba(24,32,40,0.94)_52%,rgba(9,9,11,1)_100%)]',
    glowClassName: 'bg-slate-300/12',
    iconClassName: 'text-slate-100/74',
    orbClassName:
      'bg-[radial-gradient(circle_at_20%_18%,rgba(148,163,184,0.18),transparent_28%),radial-gradient(circle_at_84%_18%,rgba(71,85,105,0.2),transparent_26%),radial-gradient(circle_at_72%_80%,rgba(56,189,248,0.1),transparent_22%)]',
    overlayClassName:
      'bg-[linear-gradient(180deg,rgba(9,9,11,0.1)_0%,rgba(9,9,11,0.36)_44%,rgba(9,9,11,0.78)_100%)]',
    ringClassName: 'border-white/10',
  },
  rain: {
    backdropClassName:
      'bg-[linear-gradient(135deg,rgba(15,31,51,0.98)_0%,rgba(18,24,36,0.95)_52%,rgba(9,9,11,1)_100%)]',
    glowClassName: 'bg-sky-300/16',
    iconClassName: 'text-sky-100/84',
    orbClassName:
      'bg-[radial-gradient(circle_at_18%_18%,rgba(56,189,248,0.18),transparent_28%),radial-gradient(circle_at_84%_16%,rgba(96,165,250,0.16),transparent_24%),radial-gradient(circle_at_70%_80%,rgba(14,116,144,0.16),transparent_24%)]',
    overlayClassName:
      'bg-[linear-gradient(180deg,rgba(9,9,11,0.08)_0%,rgba(9,9,11,0.34)_42%,rgba(9,9,11,0.78)_100%)]',
    ringClassName: 'border-white/10',
  },
  snow: {
    backdropClassName:
      'bg-[linear-gradient(135deg,rgba(28,39,52,0.96)_0%,rgba(17,22,31,0.95)_52%,rgba(9,9,11,1)_100%)]',
    glowClassName: 'bg-cyan-100/12',
    iconClassName: 'text-cyan-50/86',
    orbClassName:
      'bg-[radial-gradient(circle_at_18%_18%,rgba(186,230,253,0.16),transparent_28%),radial-gradient(circle_at_84%_16%,rgba(224,242,254,0.14),transparent_24%),radial-gradient(circle_at_68%_80%,rgba(148,163,184,0.12),transparent_22%)]',
    overlayClassName:
      'bg-[linear-gradient(180deg,rgba(9,9,11,0.08)_0%,rgba(9,9,11,0.34)_44%,rgba(9,9,11,0.78)_100%)]',
    ringClassName: 'border-white/10',
  },
  storm: {
    backdropClassName:
      'bg-[linear-gradient(135deg,rgba(21,18,44,0.98)_0%,rgba(21,25,35,0.95)_52%,rgba(9,9,11,1)_100%)]',
    glowClassName: 'bg-violet-300/14',
    iconClassName: 'text-violet-100/82',
    orbClassName:
      'bg-[radial-gradient(circle_at_18%_18%,rgba(129,140,248,0.16),transparent_28%),radial-gradient(circle_at_84%_14%,rgba(168,85,247,0.14),transparent_24%),radial-gradient(circle_at_72%_80%,rgba(56,189,248,0.14),transparent_22%)]',
    overlayClassName:
      'bg-[linear-gradient(180deg,rgba(9,9,11,0.1)_0%,rgba(9,9,11,0.38)_44%,rgba(9,9,11,0.8)_100%)]',
    ringClassName: 'border-white/10',
  },
  wind: {
    backdropClassName:
      'bg-[linear-gradient(135deg,rgba(26,28,34,0.98)_0%,rgba(18,29,39,0.95)_52%,rgba(9,9,11,1)_100%)]',
    glowClassName: 'bg-sky-200/12',
    iconClassName: 'text-slate-100/78',
    orbClassName:
      'bg-[radial-gradient(circle_at_18%_18%,rgba(148,163,184,0.16),transparent_28%),radial-gradient(circle_at_84%_14%,rgba(125,211,252,0.14),transparent_24%),radial-gradient(circle_at_70%_80%,rgba(56,189,248,0.12),transparent_22%)]',
    overlayClassName:
      'bg-[linear-gradient(180deg,rgba(9,9,11,0.08)_0%,rgba(9,9,11,0.34)_44%,rgba(9,9,11,0.78)_100%)]',
    ringClassName: 'border-white/10',
  },
};
const degreeSymbol = '\u00b0';

type PartialWeatherMessageParams = {
  hasFallbackLocation: boolean;
  isDailyRangeMissing: boolean;
};

function capitalizeLabel(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getWeatherConditionLabel(weather: DashboardWeatherState) {
  if (weather.status === 'success' || weather.status === 'partial') {
    return weather.data.conditionLabel;
  }

  if (weather.status === 'loading') {
    return 'Consultando clima';
  }

  if (weather.status === 'error') {
    return 'Clima no disponible';
  }

  return 'Clima listo para integrarse';
}

export function buildHeroMessage({ operationalLabel, timeBlock, weather }: HeroCopyParams) {
  const conditionLabel = getWeatherConditionLabel(weather);

  if (weather.status === 'success' || weather.status === 'partial') {
    if (timeBlock === 'morning') {
      return `${conditionLabel} y ${weather.data.temperature}${degreeSymbol} ahora mismo. Una lectura clara para empezar el dia con foco en ${operationalLabel}.`;
    }

    if (timeBlock === 'afternoon') {
      return `${conditionLabel} y ${weather.data.temperature}${degreeSymbol} sostienen el contexto del dia. Mantiene el ritmo operativo bien orientado en ${operationalLabel}.`;
    }

    return `${conditionLabel} y ${weather.data.temperature}${degreeSymbol} marcan el cierre del dia. Buen momento para ordenar pendientes sin perder de vista ${operationalLabel}.`;
  }

  if (timeBlock === 'morning') {
    return `El tablero ya esta listo para abrir la jornada con una lectura clara de ${operationalLabel}.`;
  }

  if (timeBlock === 'afternoon') {
    return `La jornada sigue en marcha y este bloque concentra el contexto principal de ${operationalLabel}.`;
  }

  return `Todo queda resumido en un solo vistazo para cerrar el dia con criterio en ${operationalLabel}.`;
}

export function buildSupportingNote({
  needsRestaurantSelection,
  operationalLabel,
  timeBlock,
  weather,
}: SupportingNoteParams) {
  if (needsRestaurantSelection) {
    return 'Sin una sucursal activa, el resto del dashboard pierde contexto operativo.';
  }

  if (weather.status === 'partial') {
    return weather.message ?? `Mostrando clima actual con algunos datos pendientes para ${operationalLabel}.`;
  }

  if (weather.status === 'success') {
    return `Contexto operativo listo para ${operationalLabel}.`;
  }

  if (weather.status === 'error') {
    return weather.message;
  }

  if (weather.status === 'loading') {
    return 'Buscando ubicacion y completando el contexto atmosferico del widget.';
  }

  if (timeBlock === 'night') {
    return 'Activa el clima si quieres sumar una capa mas de contexto antes de cerrar el dia.';
  }

  return 'Activa el clima para convertir este saludo en un panel contextual mas completo.';
}

export function buildPartialWeatherMessage({
  hasFallbackLocation,
  isDailyRangeMissing,
}: PartialWeatherMessageParams) {
  if (hasFallbackLocation && isDailyRangeMissing) {
    return 'Mostrando clima real con ubicacion neutra y algunos datos secundarios pendientes.';
  }

  if (hasFallbackLocation) {
    return 'Mostrando clima real sin poder resolver una localidad precisa.';
  }

  if (isDailyRangeMissing) {
    return 'Mostrando clima actual con maximos y minimos pendientes.';
  }

  return 'Mostrando clima actual con algunos datos secundarios pendientes.';
}

export function formatCalendarLabel(now: Date) {
  return capitalizeLabel(
    new Intl.DateTimeFormat('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'long',
    }).format(now),
  );
}

export function getDashboardHeroVisual(
  timeBlock: DashboardHeroTimeBlock,
  weather: DashboardWeatherState,
) {
  const tone =
    weather.status === 'success' || weather.status === 'partial'
      ? weather.data.tone
      : timeBlock;

  return heroVisuals[tone];
}

export function getFirstName(userName: string) {
  const firstName = userName.trim().split(/\s+/)[0];
  return firstName || 'equipo';
}

export function getGreeting(timeBlock: DashboardHeroTimeBlock) {
  if (timeBlock === 'morning') return 'Buenos dias';
  if (timeBlock === 'afternoon') return 'Buenas tardes';
  return 'Buenas noches';
}

export function getHeroStatusLabel(weather: DashboardWeatherState) {
  if (weather.status === 'success') return 'Clima en vivo';
  if (weather.status === 'partial') return 'Clima parcial';
  if (weather.status === 'loading') return 'Sincronizando';
  if (weather.status === 'error') return 'Clima no disponible';
  return 'Activa el clima';
}

export function getOperationalLabel(
  canPickRestaurant: boolean,
  hasEffectiveRestaurant: boolean,
  effectiveRestaurantName: string,
) {
  if (canPickRestaurant && !hasEffectiveRestaurant) {
    return 'tu sucursal pendiente';
  }

  return effectiveRestaurantName;
}

export function getOperationalPillLabel(
  canPickRestaurant: boolean,
  hasEffectiveRestaurant: boolean,
  effectiveRestaurantName: string,
) {
  if (canPickRestaurant && !hasEffectiveRestaurant) {
    return 'Selecciona una sucursal';
  }

  return `Operacion en ${effectiveRestaurantName}`;
}

export function getTemperatureLabel(weather: DashboardWeatherState) {
  if (weather.status === 'success' || weather.status === 'partial') {
    return `${weather.data.temperature}${degreeSymbol}`;
  }

  return '--';
}

export function getTimeBlock(now: Date): DashboardHeroTimeBlock {
  const hour = now.getHours();

  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 20) return 'afternoon';
  return 'night';
}

export function getTimePillLabel(timeBlock: DashboardHeroTimeBlock) {
  if (timeBlock === 'morning') return 'Manana en curso';
  if (timeBlock === 'afternoon') return 'Tarde en marcha';
  return 'Cierre del dia';
}

export function getWeatherActionLabel(weather: DashboardWeatherState) {
  if (weather.status === 'idle') return 'Activar clima';
  if (weather.status === 'error') return 'Reintentar';
  return null;
}

export function getWeatherActionMessage(weather: DashboardWeatherState) {
  if (weather.status === 'loading') {
    return 'Buscando ubicacion y consultando el pronostico del dia.';
  }

  if (weather.status === 'idle') {
    return 'Usa tu ubicacion para sumar temperatura, condicion y maximos del dia.';
  }

  if (weather.status === 'error') {
    return weather.message;
  }

  if (weather.status === 'partial') {
    return weather.message ?? 'Mostrando clima actual con datos parciales.';
  }

  return null;
}

export function getWeatherDetailItems(weather: DashboardWeatherState, now: Date) {
  const calendarLabel = formatCalendarLabel(now);
  const statusLabel = getHeroStatusLabel(weather);

  if (weather.status === 'success' || weather.status === 'partial') {
    return [
      { label: 'Hoy', value: calendarLabel },
      {
        label: 'Max / min',
        value:
          weather.data.high !== null && weather.data.low !== null
            ? `${weather.data.high}${degreeSymbol} / ${weather.data.low}${degreeSymbol}`
            : 'Sin pronostico completo',
      },
      {
        label: 'Viento',
        value:
          weather.data.windSpeed !== null
            ? `${weather.data.windSpeed} km/h`
            : 'No disponible',
      },
      { label: 'Estado', value: statusLabel },
    ];
  }

  return [
    { label: 'Hoy', value: calendarLabel },
    { label: 'Max / min', value: '-- / --' },
    { label: 'Viento', value: '--' },
    { label: 'Estado', value: statusLabel },
  ];
}

function getWeatherIconComponent(
  weatherIcon: DashboardWeatherIconName,
): ComponentType<{ className?: string }> {
  if (weatherIcon === 'sun') return SunMedium;
  if (weatherIcon === 'moon') return MoonStar;
  if (weatherIcon === 'cloud-sun') return CloudSun;
  if (weatherIcon === 'rain') return CloudRain;
  if (weatherIcon === 'snow') return CloudSnow;
  if (weatherIcon === 'storm') return CloudLightning;
  if (weatherIcon === 'wind') return Wind;
  return Cloud;
}

export function renderWeatherIcon(
  weatherIcon: DashboardWeatherIconName,
  className?: string,
) {
  return createElement(getWeatherIconComponent(weatherIcon), {
    className,
  });
}

export function getWeatherLocationLabel(weather: DashboardWeatherState) {
  if (weather.status === 'success' || weather.status === 'partial') {
    return weather.data.locationLabel;
  }

  if (weather.status === 'loading') {
    return 'Ubicacion en curso';
  }

  if (weather.status === 'error') {
    return 'Sin ubicacion disponible';
  }

  return 'Ubicacion pendiente';
}

export function resolveWeatherDescriptor(
  weatherCode: number,
  isDay: boolean,
  windSpeed: number | null,
) {
  if (windSpeed !== null && windSpeed >= 35 && weatherCode <= 3) {
    return {
      conditionLabel: 'Viento',
      iconName: 'wind' as const,
      tone: 'wind' as const,
    };
  }

  if (weatherCode === 0) {
    return {
      conditionLabel: isDay ? 'Soleado' : 'Despejado',
      iconName: isDay ? ('sun' as const) : ('moon' as const),
      tone: 'clear' as const,
    };
  }

  if (weatherCode === 1 || weatherCode === 2) {
    return {
      conditionLabel: 'Parcialmente nublado',
      iconName: 'cloud-sun' as const,
      tone: 'partly-cloudy' as const,
    };
  }

  if (weatherCode === 3) {
    return {
      conditionLabel: 'Nublado',
      iconName: 'cloud' as const,
      tone: 'cloudy' as const,
    };
  }

  if (weatherCode === 45 || weatherCode === 48) {
    return {
      conditionLabel: 'Niebla',
      iconName: 'wind' as const,
      tone: 'wind' as const,
    };
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
    return {
      conditionLabel: 'Lluvia',
      iconName: 'rain' as const,
      tone: 'rain' as const,
    };
  }

  if (
    weatherCode === 71 ||
    weatherCode === 73 ||
    weatherCode === 75 ||
    weatherCode === 77 ||
    weatherCode === 85 ||
    weatherCode === 86
  ) {
    return {
      conditionLabel: 'Nieve',
      iconName: 'snow' as const,
      tone: 'snow' as const,
    };
  }

  if (weatherCode === 95 || weatherCode === 96 || weatherCode === 99) {
    return {
      conditionLabel: 'Tormenta',
      iconName: 'storm' as const,
      tone: 'storm' as const,
    };
  }

  return {
    conditionLabel: 'Variable',
    iconName: 'cloud' as const,
    tone: 'cloudy' as const,
  };
}
