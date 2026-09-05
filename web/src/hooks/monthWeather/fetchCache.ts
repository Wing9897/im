import { fetchWeatherForecast } from "../../api/weather";
import { dateKey } from "../../domain/timeline/dateUtils";

export type DailyWeather = {
  code: number;
  high: number;
  low: number;
};

export type WeatherRange = {
  startDate: string;
  endDate: string;
};

type CachedWeather = {
  expiresAt: number;
  weatherByDate: Record<string, DailyWeather>;
};

type CachedFailure = {
  error: string;
  expiresAt: number;
};

type InFlightWeather = {
  controller: AbortController;
  promise: Promise<Record<string, DailyWeather>>;
  subscribers: number;
};

const FORECAST_WINDOW_DAYS = 16;
/** Successful forecasts stay fresh for one hour (aligned with auto-refresh / board poll). */
export const WEATHER_CACHE_MS = 60 * 60 * 1000;
export const WEATHER_FAILURE_CACHE_MS = 30 * 1000;

const weatherCache = new Map<string, CachedWeather>();
const weatherFailureCache = new Map<string, CachedFailure>();
const inFlightWeather = new Map<string, InFlightWeather>();

/** Test-only: clear module-level weather caches between cases. */
export function resetWeatherCachesForTests(): void {
  weatherCache.clear();
  weatherFailureCache.clear();
  for (const request of inFlightWeather.values()) {
    request.controller.abort();
  }
  inFlightWeather.clear();
}

export function forecastIntersection(monthDays: Date[], now = new Date()): WeatherRange | null {
  const monthDateKeys = monthDays
    .filter((day) => !Number.isNaN(day.getTime()))
    .map(dateKey)
    .sort();
  if (monthDateKeys.length === 0) return null;

  const windowStart = dateKey(now);
  const windowEndDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + FORECAST_WINDOW_DAYS - 1);
  const windowEnd = dateKey(windowEndDate);
  const startDate = monthDateKeys[0] > windowStart ? monthDateKeys[0] : windowStart;
  const monthEnd = monthDateKeys.at(-1)!;
  const endDate = monthEnd < windowEnd ? monthEnd : windowEnd;
  return startDate <= endDate ? { startDate, endDate } : null;
}

async function fetchWeather(
  location: string,
  range: WeatherRange,
  signal: AbortSignal,
  force = false,
): Promise<Record<string, DailyWeather>> {
  const { daily } = await fetchWeatherForecast(
    location,
    range.startDate,
    range.endDate,
    { signal, force },
  );
  if (!daily?.time || !daily.weather_code || !daily.temperature_2m_max || !daily.temperature_2m_min) {
    return {};
  }
  return Object.fromEntries(
    daily.time.map((date, index) => [
      date,
      {
        code: daily.weather_code![index],
        high: Math.round(daily.temperature_2m_max![index]),
        low: Math.round(daily.temperature_2m_min![index]),
      },
    ]),
  );
}

export function subscribeToWeather(
  cacheKey: string,
  location: string,
  range: WeatherRange,
  force = false,
): { promise: Promise<Record<string, DailyWeather>>; release: () => void } {
  if (force) {
    const existing = inFlightWeather.get(cacheKey);
    if (existing) {
      existing.controller.abort();
      inFlightWeather.delete(cacheKey);
    }
  }
  let request = inFlightWeather.get(cacheKey);
  if (!request) {
    const controller = new AbortController();
    const promise = fetchWeather(location, range, controller.signal, force).finally(() => {
      const current = inFlightWeather.get(cacheKey);
      if (current?.promise === promise) inFlightWeather.delete(cacheKey);
    });
    request = { controller, promise, subscribers: 0 };
    inFlightWeather.set(cacheKey, request);
  }
  request.subscribers += 1;

  let released = false;
  return {
    promise: request.promise,
    release: () => {
      if (released) return;
      released = true;
      request.subscribers -= 1;
      if (request.subscribers === 0 && inFlightWeather.get(cacheKey) === request) {
        inFlightWeather.delete(cacheKey);
        request.controller.abort();
      }
    },
  };
}

export function readWeatherCache(cacheKey: string): Record<string, DailyWeather> | null {
  const cached = weatherCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.weatherByDate;
  if (cached) weatherCache.delete(cacheKey);
  return null;
}

export function writeWeatherCache(cacheKey: string, weatherByDate: Record<string, DailyWeather>): void {
  weatherCache.set(cacheKey, { weatherByDate, expiresAt: Date.now() + WEATHER_CACHE_MS });
  weatherFailureCache.delete(cacheKey);
}

export function readWeatherFailure(cacheKey: string): string | null {
  const cachedFailure = weatherFailureCache.get(cacheKey);
  if (cachedFailure && cachedFailure.expiresAt > Date.now()) return cachedFailure.error;
  if (cachedFailure) weatherFailureCache.delete(cacheKey);
  return null;
}

export function writeWeatherFailure(cacheKey: string, error: string): void {
  weatherFailureCache.set(cacheKey, {
    error,
    expiresAt: Date.now() + WEATHER_FAILURE_CACHE_MS,
  });
}

export function clearWeatherCaches(cacheKey: string): void {
  weatherCache.delete(cacheKey);
  weatherFailureCache.delete(cacheKey);
}
