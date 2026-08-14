import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchSystemSettings } from "../api/config";
import { toErrorMessage } from "../utils/errors";
import {
  clearWeatherCaches,
  forecastIntersection,
  readWeatherCache,
  readWeatherFailure,
  subscribeToWeather,
  writeWeatherCache,
  writeWeatherFailure,
  type DailyWeather,
} from "./monthWeather/fetchCache";
import { systemLocation } from "./monthWeather/timezone";

export type { DailyWeather } from "./monthWeather/fetchCache";
export {
  forecastIntersection,
  resetWeatherCachesForTests,
  WEATHER_CACHE_MS,
} from "./monthWeather/fetchCache";
export { systemLocationFromTimezone } from "./monthWeather/timezone";

/** Auto-refresh interval for visible calendar weather. */
export const WEATHER_REFRESH_MS = 60 * 60 * 1000;

type LoadWeatherOptions = {
  force?: boolean;
};

/** Fetches the forecastable part of a visible month without disturbing calendar use on failure. */
export function useMonthWeather(enabled: boolean, monthDays: Date[]) {
  const [weatherByDate, setWeatherByDate] = useState<Record<string, DailyWeather>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const forceNextLoadRef = useRef(false);
  const requestRange = useMemo(
    () => {
      const intersection = forecastIntersection(monthDays);
      return intersection ? `${intersection.startDate}:${intersection.endDate}` : "";
    },
    [monthDays],
  );

  const refresh = useCallback(() => {
    forceNextLoadRef.current = true;
    setRefreshTick((tick) => tick + 1);
  }, []);

  useEffect(() => {
    if (!enabled || !requestRange) {
      setWeatherByDate({});
      setError(null);
      setLoading(false);
      return;
    }
    const [startDate, endDate] = requestRange.split(":");
    const range = { startDate, endDate };
    const force = forceNextLoadRef.current;
    forceNextLoadRef.current = false;
    let cancelled = false;
    let releaseRequest: (() => void) | undefined;
    const load = async (opts: LoadWeatherOptions = {}) => {
      setError(null);
      let failureCacheKey = `${requestRange}:settings`;
      try {
        if (!opts.force) {
          const settingsFailure = readWeatherFailure(failureCacheKey);
          if (settingsFailure) {
            setError(settingsFailure);
            return;
          }
        } else {
          clearWeatherCaches(failureCacheKey);
        }

        const { weatherLocation } = await fetchSystemSettings();
        if (cancelled) return;
        const location = weatherLocation === "system" ? systemLocation() : weatherLocation.trim();
        if (!location) {
          setWeatherByDate({});
          return;
        }
        const cacheKey = `${location}:${requestRange}`;
        failureCacheKey = cacheKey;

        if (opts.force) {
          clearWeatherCaches(cacheKey);
        } else {
          const cached = readWeatherCache(cacheKey);
          if (cached) {
            setWeatherByDate(cached);
            return;
          }
          const cachedFailure = readWeatherFailure(cacheKey);
          if (cachedFailure) {
            setError(cachedFailure);
            return;
          }
        }

        setLoading(true);
        const subscription = subscribeToWeather(cacheKey, location, range, Boolean(opts.force));
        releaseRequest = subscription.release;
        let weather: Record<string, DailyWeather>;
        try {
          weather = await subscription.promise;
        } finally {
          subscription.release();
          releaseRequest = undefined;
        }
        if (cancelled) return;
        writeWeatherCache(cacheKey, weather);
        setWeatherByDate(weather);
      } catch (cause) {
        if (!cancelled) {
          const message = toErrorMessage(cause);
          writeWeatherFailure(failureCacheKey, message);
          setError(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load({ force });

    const intervalId = window.setInterval(() => {
      forceNextLoadRef.current = true;
      void load({ force: true });
    }, WEATHER_REFRESH_MS);

    return () => {
      cancelled = true;
      releaseRequest?.();
      window.clearInterval(intervalId);
    };
  }, [enabled, requestRange, refreshTick]);

  return { weatherByDate, error, loading, refresh };
}

export function weatherIcon(code: number): string {
  if (code === 0) return "☀️";
  if (code <= 2) return "🌤️";
  if (code === 3) return "☁️";
  if (code <= 48) return "🌫️";
  if (code <= 67 || (code >= 80 && code <= 82)) return "🌧️";
  if (code <= 77 || (code >= 85 && code <= 86)) return "🌨️";
  if (code >= 95) return "⛈️";
  return "🌡️";
}
