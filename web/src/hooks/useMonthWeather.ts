import { useEffect, useMemo, useState } from "react";
import { fetchSystemSettings } from "../api/config";
import { fetchWeatherForecast } from "../api/weather";
import { dateKey } from "../utils/dateFormat";
import { toErrorMessage } from "../utils/errors";

export type DailyWeather = {
  code: number;
  high: number;
  low: number;
};

type WeatherRange = {
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
const WEATHER_CACHE_MS = 30 * 60 * 1000;
const WEATHER_FAILURE_CACHE_MS = 30 * 1000;
const weatherCache = new Map<string, CachedWeather>();
const weatherFailureCache = new Map<string, CachedFailure>();
const inFlightWeather = new Map<string, InFlightWeather>();
const SYSTEM_TIMEZONE_LOCATIONS: Record<string, string> = {
  "Asia/Taipei": "臺北",
  "Asia/Hong_Kong": "香港",
  "Asia/Tokyo": "東京",
  "Asia/Shanghai": "上海",
  "Asia/Singapore": "新加坡",
  "Asia/Seoul": "首爾",
  "America/New_York": "New York",
  "America/Los_Angeles": "Los Angeles",
  "Europe/London": "London",
  "Europe/Paris": "Paris",
};

export function systemLocationFromTimezone(timezone: string): string {
  const knownLocation = SYSTEM_TIMEZONE_LOCATIONS[timezone];
  if (knownLocation) return knownLocation;
  const segments = timezone.split("/");
  const inferredCity = segments.at(-1)?.replaceAll("_", " ");
  // UTC and other non-geographic zones do not identify a city. A predictable
  // fallback keeps the default setting useful until a custom city is chosen.
  return inferredCity && inferredCity !== "UTC" ? inferredCity : "臺北";
}

function systemLocation(): string {
  return systemLocationFromTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
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
): Promise<Record<string, DailyWeather>> {
  const { daily } = await fetchWeatherForecast(location, range.startDate, range.endDate, signal);
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

function subscribeToWeather(
  cacheKey: string,
  location: string,
  range: WeatherRange,
): { promise: Promise<Record<string, DailyWeather>>; release: () => void } {
  let request = inFlightWeather.get(cacheKey);
  if (!request) {
    const controller = new AbortController();
    const promise = fetchWeather(location, range, controller.signal).finally(() => {
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

/** Fetches the forecastable part of a visible month without disturbing calendar use on failure. */
export function useMonthWeather(enabled: boolean, monthDays: Date[]) {
  const [weatherByDate, setWeatherByDate] = useState<Record<string, DailyWeather>>({});
  const [error, setError] = useState<string | null>(null);
  const requestRange = useMemo(
    () => {
      const intersection = forecastIntersection(monthDays);
      return intersection ? `${intersection.startDate}:${intersection.endDate}` : "";
    },
    [monthDays],
  );

  useEffect(() => {
    if (!enabled || !requestRange) {
      setWeatherByDate({});
      setError(null);
      return;
    }
    const [startDate, endDate] = requestRange.split(":");
    const range = { startDate, endDate };
    let cancelled = false;
    let releaseRequest: (() => void) | undefined;
    const load = async () => {
      setWeatherByDate({});
      setError(null);
      let failureCacheKey = `${requestRange}:settings`;
      try {
        const settingsFailure = weatherFailureCache.get(failureCacheKey);
        if (settingsFailure && settingsFailure.expiresAt > Date.now()) {
          setError(settingsFailure.error);
          return;
        }
        if (settingsFailure) weatherFailureCache.delete(failureCacheKey);

        const { weatherLocation } = await fetchSystemSettings();
        if (cancelled) return;
        const location = weatherLocation === "system" ? systemLocation() : weatherLocation.trim();
        if (!location) {
          setWeatherByDate({});
          return;
        }
        const cacheKey = `${location}:${requestRange}`;
        failureCacheKey = cacheKey;
        const cached = weatherCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
          setWeatherByDate(cached.weatherByDate);
          return;
        }
        if (cached) weatherCache.delete(cacheKey);

        const cachedFailure = weatherFailureCache.get(cacheKey);
        if (cachedFailure && cachedFailure.expiresAt > Date.now()) {
          setError(cachedFailure.error);
          return;
        }
        if (cachedFailure) weatherFailureCache.delete(cacheKey);

        const subscription = subscribeToWeather(cacheKey, location, range);
        releaseRequest = subscription.release;
        let weather: Record<string, DailyWeather>;
        try {
          weather = await subscription.promise;
        } finally {
          subscription.release();
          releaseRequest = undefined;
        }
        if (cancelled) return;
        weatherCache.set(cacheKey, { weatherByDate: weather, expiresAt: Date.now() + WEATHER_CACHE_MS });
        weatherFailureCache.delete(cacheKey);
        setWeatherByDate(weather);
      } catch (cause) {
        if (!cancelled) {
          const message = toErrorMessage(cause);
          weatherFailureCache.set(failureCacheKey, {
            error: message,
            expiresAt: Date.now() + WEATHER_FAILURE_CACHE_MS,
          });
          setWeatherByDate({});
          setError(message);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
      releaseRequest?.();
    };
  }, [enabled, requestRange]);

  return { weatherByDate, error };
}

export function weatherIcon(code: number): string {
  if (code === 0) return "☀️";
  if (code <= 2) return "🌤️";
  if (code === 3) return "☁️";
  if (code <= 48) return "🌫️";
  if (code <= 67 || code >= 80 && code <= 82) return "🌧️";
  if (code <= 77 || code >= 85 && code <= 86) return "🌨️";
  if (code >= 95) return "⛈️";
  return "🌡️";
}
