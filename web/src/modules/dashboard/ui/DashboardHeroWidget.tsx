'use client';

import { LoaderCircle, MapPin } from 'lucide-react';
import { useEffect, useState } from 'react';

import { cx } from '@/shared/ui/cx';

import {
  buildHeroMessage,
  buildSupportingNote,
  type DashboardHeroWidgetProps,
  type DashboardWeatherState,
  getDashboardHeroVisual,
  getFirstName,
  getGreeting,
  getHeroStatusLabel,
  getOperationalLabel,
  getOperationalPillLabel,
  getTemperatureLabel,
  getTimeBlock,
  getTimePillLabel,
  getWeatherActionLabel,
  getWeatherActionMessage,
  getWeatherDetailItems,
  getWeatherLocationLabel,
  renderWeatherIcon,
} from './dashboardHeroModels';
import { useDashboardHeroWeather } from './useDashboardHeroWeather';

type DashboardHeroWidgetViewProps = DashboardHeroWidgetProps & {
  now: Date;
  onRequestWeather: () => void;
  weather: DashboardWeatherState;
};

export function DashboardHeroWidget({
  canPickRestaurant,
  effectiveRestaurantName,
  hasEffectiveRestaurant,
  userName,
}: DashboardHeroWidgetProps) {
  const [now, setNow] = useState(() => new Date());
  const { requestWeather, weather } = useDashboardHeroWeather();

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(new Date());
    }, 60_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <DashboardHeroWidgetView
      canPickRestaurant={canPickRestaurant}
      effectiveRestaurantName={effectiveRestaurantName}
      hasEffectiveRestaurant={hasEffectiveRestaurant}
      now={now}
      onRequestWeather={requestWeather}
      userName={userName}
      weather={weather}
    />
  );
}

export function DashboardHeroWidgetView({
  canPickRestaurant,
  effectiveRestaurantName,
  hasEffectiveRestaurant,
  now,
  onRequestWeather,
  userName,
  weather,
}: DashboardHeroWidgetViewProps) {
  const timeBlock = getTimeBlock(now);
  const firstName = getFirstName(userName);
  const greeting = getGreeting(timeBlock);
  const operationalLabel = getOperationalLabel(
    canPickRestaurant,
    hasEffectiveRestaurant,
    effectiveRestaurantName,
  );
  const operationalPillLabel = getOperationalPillLabel(
    canPickRestaurant,
    hasEffectiveRestaurant,
    effectiveRestaurantName,
  );
  const heroMessage = buildHeroMessage({
    operationalLabel,
    timeBlock,
    weather,
  });
  const heroNote = buildSupportingNote({
    needsRestaurantSelection: canPickRestaurant && !hasEffectiveRestaurant,
    operationalLabel,
    timeBlock,
    weather,
  });
  const visual = getDashboardHeroVisual(timeBlock, weather);
  const heroStatusLabel = getHeroStatusLabel(weather);
  const detailItems = getWeatherDetailItems(weather, now);
  const temperatureLabel = getTemperatureLabel(weather);
  const actionLabel = getWeatherActionLabel(weather);
  const actionMessage = getWeatherActionMessage(weather);
  const locationLabel = getWeatherLocationLabel(weather);
  const weatherIconName =
    weather.status === 'success' || weather.status === 'partial'
      ? weather.data.iconName
      : timeBlock === 'night'
        ? 'moon'
        : 'sun';

  const statusPillClassName =
    weather.status === 'success'
      ? 'border-white/12 bg-white/8 text-white/78'
      : weather.status === 'partial'
        ? 'border-amber-200/20 bg-amber-100/10 text-amber-50'
        : weather.status === 'loading'
          ? 'border-sky-200/18 bg-sky-100/10 text-sky-50'
          : weather.status === 'error'
            ? 'border-rose-300/24 bg-rose-200/12 text-rose-50'
            : 'border-white/12 bg-white/6 text-white/68';

  const climateHeading =
    weather.status === 'success' || weather.status === 'partial'
      ? weather.data.conditionLabel
      : weather.status === 'loading'
        ? 'Sincronizando clima'
        : weather.status === 'error'
          ? 'Contexto atmosferico no disponible'
          : 'Clima listo para integrarse';

  return (
    <section
      aria-labelledby="dashboard-hero-heading"
      className={cx(
        'relative isolate overflow-hidden rounded-[28px] border shadow-[0_32px_80px_-44px_rgba(0,0,0,0.92)]',
        visual.ringClassName,
      )}
    >
      <div className={cx('absolute inset-0', visual.backdropClassName)} />
      <div className={cx('absolute inset-0 opacity-95', visual.orbClassName)} />
      <div
        className={cx(
          'pointer-events-none absolute -right-24 top-[-20%] h-80 w-80 rounded-full blur-3xl',
          visual.glowClassName,
        )}
      />
      <div className={cx('absolute inset-0', visual.overlayClassName)} />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/24 to-transparent" />

      <div className="pointer-events-none absolute right-[-5%] top-5 hidden lg:block">
        <div className="relative flex h-52 w-52 items-center justify-center">
          <div className="absolute inset-4 rounded-full border border-white/8 bg-white/4 blur-2xl" />
          <span aria-hidden="true">
            {renderWeatherIcon(weatherIconName, cx('relative h-28 w-28', visual.iconClassName))}
          </span>
        </div>
      </div>

      <div className="relative flex min-h-[320px] flex-col justify-between gap-8 px-5 py-5 sm:min-h-[340px] sm:px-6 sm:py-6 lg:px-8 lg:py-7">
        <div className="max-w-3xl">
          <p className="text-[0.68rem] font-medium uppercase tracking-[0.34em] text-white/58">
            Tu momento ahora
          </p>
          <h2
            id="dashboard-hero-heading"
            className="mt-3 max-w-2xl text-[clamp(2rem,4.8vw,3.5rem)] font-semibold leading-[0.95] tracking-[-0.05em] text-white"
          >
            {`${greeting}, ${firstName}`}
          </h2>
          <p className="mt-4 max-w-[58ch] text-sm leading-6 text-white/74 sm:text-[0.98rem]">
            {heroMessage}
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <span className="rounded-full border border-white/12 bg-white/7 px-3 py-1.5 text-[0.76rem] font-medium text-white/80 backdrop-blur-sm">
              {operationalPillLabel}
            </span>
            <span className="rounded-full border border-white/10 bg-black/12 px-3 py-1.5 text-[0.76rem] font-medium text-white/68 backdrop-blur-sm">
              {getTimePillLabel(timeBlock)}
            </span>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] lg:items-end">
          <div className="flex flex-col gap-3 lg:max-w-2xl">
            <p className="text-sm leading-6 text-white/64">{heroNote}</p>
          </div>

          <div
            aria-live="polite"
            className="flex flex-col gap-4 border-t border-white/10 pt-4 lg:items-end lg:border-t-0 lg:pt-0"
          >
            <div className="flex w-full items-start justify-between gap-4 lg:max-w-sm">
              <div className="min-w-0">
                <span
                  className={cx(
                    'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[0.72rem] font-medium uppercase tracking-[0.2em] backdrop-blur-sm',
                    statusPillClassName,
                  )}
                >
                  {weather.status === 'loading' ? (
                    <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : null}
                  {heroStatusLabel}
                </span>

                <div className="mt-4 flex items-end gap-3">
                  <p
                    className={cx(
                      'text-[clamp(3.4rem,10vw,5.4rem)] font-semibold leading-none tracking-[-0.06em] text-white',
                      weather.status === 'loading' && 'animate-pulse',
                    )}
                  >
                    {temperatureLabel}
                  </p>
                  {weather.status === 'loading' ? (
                    <LoaderCircle
                      className="mb-2 h-7 w-7 shrink-0 animate-spin text-white/74"
                      aria-hidden="true"
                    />
                  ) : (
                    <span aria-hidden="true">
                      {renderWeatherIcon(
                        weatherIconName,
                        'mb-2 h-7 w-7 shrink-0 text-white/74',
                      )}
                    </span>
                  )}
                </div>

                <p className="mt-2 text-[1rem] font-medium text-white/92">{climateHeading}</p>

                <p className="mt-1 flex items-center gap-2 text-sm text-white/58">
                  <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{locationLabel}</span>
                </p>
              </div>
            </div>

            <dl className="grid w-full grid-cols-2 gap-x-6 gap-y-3 lg:max-w-sm">
              {detailItems.map((item) => (
                <div key={item.label} className="min-w-0">
                  <dt className="text-[0.72rem] uppercase tracking-[0.2em] text-white/42">
                    {item.label}
                  </dt>
                  <dd className="mt-1 text-sm leading-5 text-white/76">{item.value}</dd>
                </div>
              ))}
            </dl>

            {actionLabel ? (
              <div className="flex w-full flex-col gap-3 lg:max-w-sm">
                <p className="text-sm leading-5 text-white/60">{actionMessage}</p>
                <button
                  type="button"
                  onClick={onRequestWeather}
                  className="inline-flex min-h-11 w-fit items-center justify-center rounded-full border border-white/14 bg-white/8 px-4 py-2 text-sm font-medium text-white transition duration-200 hover:border-white/22 hover:bg-white/12 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
                >
                  {actionLabel}
                </button>
              </div>
            ) : actionMessage ? (
              <p className="w-full text-sm leading-5 text-white/60 lg:max-w-sm">
                {actionMessage}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
