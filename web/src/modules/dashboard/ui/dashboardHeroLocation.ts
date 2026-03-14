export type DashboardCoordinates = {
  latitude: number;
  longitude: number;
};

export type DashboardResolvedLocation = {
  label: string;
  precision: 'city' | 'fallback' | 'locality' | 'subdivision';
  source: 'fallback' | 'reverse-geocode';
};

type BigDataCloudReverseGeocodeResponse = {
  city?: string | null;
  countryCode?: string | null;
  locality?: string | null;
  localityInfo?: {
    administrative?: Array<{
      description?: string | null;
      name?: string | null;
      order?: number | null;
    }>;
    informative?: Array<{
      description?: string | null;
      name?: string | null;
      order?: number | null;
    }>;
  };
  lookupSource?: string | null;
  principalSubdivision?: string | null;
};

const reverseGeocodeEndpoint =
  'https://api.bigdatacloud.net/data/reverse-geocode-client';

function areSameLabel(left: string | null, right: string | null) {
  if (!left || !right) return false;
  return left.localeCompare(right, undefined, { sensitivity: 'base' }) === 0;
}

function cleanLabel(value?: string | null) {
  const nextValue = value?.trim();
  return nextValue ? nextValue : null;
}

function getFallbackLocation() {
  return {
    label: 'Ubicacion actual',
    precision: 'fallback' as const,
    source: 'fallback' as const,
  };
}

function getInformativeLocality(
  payload: BigDataCloudReverseGeocodeResponse,
  excludedLabels: Array<string | null>,
) {
  const candidates = payload.localityInfo?.informative ?? [];

  for (const candidate of candidates) {
    const label = cleanLabel(candidate.name);
    if (!label) {
      continue;
    }

    const isDuplicate = excludedLabels.some((value) => areSameLabel(value, label));
    if (!isDuplicate) {
      return label;
    }
  }

  return null;
}

function shouldAppendSecondaryLabel(primary: string, secondary: string | null) {
  if (!secondary) return false;
  if (areSameLabel(primary, secondary)) return false;
  return primary.length <= 24 && secondary.length <= 24;
}

export function buildDashboardLocationLabel(
  payload: BigDataCloudReverseGeocodeResponse,
) {
  const locality = cleanLabel(payload.locality);
  const city = cleanLabel(payload.city);
  const subdivision = cleanLabel(payload.principalSubdivision);
  const informativeLocality = getInformativeLocality(payload, [
    locality,
    city,
    subdivision,
  ]);

  if (locality) {
    const secondary = !areSameLabel(locality, city) ? city : subdivision;
    return {
      label: shouldAppendSecondaryLabel(locality, secondary)
        ? `${locality}, ${secondary}`
        : locality,
      precision: 'locality' as const,
      source: 'reverse-geocode' as const,
    };
  }

  if (city) {
    return {
      label: shouldAppendSecondaryLabel(city, subdivision)
        ? `${city}, ${subdivision}`
        : city,
      precision: 'city' as const,
      source: 'reverse-geocode' as const,
    };
  }

  if (informativeLocality) {
    return {
      label: shouldAppendSecondaryLabel(informativeLocality, subdivision)
        ? `${informativeLocality}, ${subdivision}`
        : informativeLocality,
      precision: 'locality' as const,
      source: 'reverse-geocode' as const,
    };
  }

  if (subdivision) {
    return {
      label: subdivision,
      precision: 'subdivision' as const,
      source: 'reverse-geocode' as const,
    };
  }

  return null;
}

export function getCurrentCoordinates() {
  return new Promise<DashboardCoordinates>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      reject,
      {
        enableHighAccuracy: false,
        maximumAge: 15 * 60_000,
        timeout: 8_000,
      },
    );
  });
}

export async function reverseGeocodeDashboardCoordinates(
  coordinates: DashboardCoordinates,
  signal: AbortSignal,
): Promise<DashboardResolvedLocation> {
  const params = new URLSearchParams({
    latitude: String(coordinates.latitude),
    localityLanguage: 'es',
    longitude: String(coordinates.longitude),
  });

  const response = await fetch(`${reverseGeocodeEndpoint}?${params.toString()}`, {
    cache: 'no-store',
    signal,
  });

  if (!response.ok) {
    throw new Error('reverse_geocode_failed');
  }

  const payload = (await response.json()) as BigDataCloudReverseGeocodeResponse;

  if (payload.lookupSource && payload.lookupSource !== 'reverseGeocoding') {
    return getFallbackLocation();
  }

  return buildDashboardLocationLabel(payload) ?? getFallbackLocation();
}

export function resolveDashboardLocationFallback() {
  return getFallbackLocation();
}
