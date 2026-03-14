'use client';

import { type DashboardWeatherState } from '@/modules/dashboard/ui/dashboardHeroModels';
import {
  DashboardHeroWidgetView,
} from '@/modules/dashboard/ui/DashboardHeroWidget';

export type DashboardHeroPreviewState =
  | 'error'
  | 'idle'
  | 'loading'
  | 'partial'
  | 'success';

const previewDate = new Date('2026-03-14T09:30:00');

const previewWeatherStates: Record<DashboardHeroPreviewState, DashboardWeatherState> = {
  error: {
    message: 'La ubicacion esta bloqueada para el clima.',
    status: 'error',
  },
  idle: {
    status: 'idle',
  },
  loading: {
    status: 'loading',
  },
  partial: {
    data: {
      conditionLabel: 'Parcialmente nublado',
      high: 19,
      iconName: 'cloud-sun',
      locationLabel: 'Ubicacion actual',
      locationSource: 'fallback',
      low: 12,
      temperature: 17,
      tone: 'partly-cloudy',
      windSpeed: 11,
    },
    message: 'Mostrando clima real sin poder resolver una localidad precisa.',
    status: 'partial',
  },
  success: {
    data: {
      conditionLabel: 'Soleado',
      high: 22,
      iconName: 'sun',
      locationLabel: 'Chamartin, Madrid',
      locationSource: 'reverse-geocode',
      low: 13,
      temperature: 20,
      tone: 'clear',
      windSpeed: 9,
    },
    status: 'success',
  },
};

export function DashboardHeroPreviewPage({
  state,
}: {
  state: DashboardHeroPreviewState;
}) {
  return (
    <main className="app-shell stack rise-in">
      <section className="page-intro">
        <div>
          <h1 className="page-title">Preview widget hero</h1>
          <p className="subtitle">
            Estado visual: <strong>{state}</strong>
          </p>
        </div>
      </section>

      <DashboardHeroWidgetView
        canPickRestaurant={false}
        effectiveRestaurantName="Madrid - Paseo de la Habana"
        hasEffectiveRestaurant={true}
        now={previewDate}
        onRequestWeather={() => {}}
        userName="Jesus Christian"
        weather={previewWeatherStates[state]}
      />
    </main>
  );
}
