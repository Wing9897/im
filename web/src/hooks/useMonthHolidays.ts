import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchSystemSettings } from "../api/config";
import { fetchCalendarHolidays, type CalendarHolidayItem } from "../api/holidays";
import { toErrorMessage } from "../utils/errors";
import { dateKey } from "../domain/timeline/dateUtils";
import { resolveWeatherLocation } from "./monthWeather/timezone";

export type DailyHoliday = CalendarHolidayItem;

const HOLIDAY_CACHE_MS = 12 * 60 * 60 * 1000;
const HOLIDAY_FAILURE_CACHE_MS = 30 * 1000;

type CachedHolidays = {
  expiresAt: number;
  holidaysByDate: Record<string, DailyHoliday[]>;
};

type CachedFailure = {
  error: string;
  expiresAt: number;
};

const holidayCache = new Map<string, CachedHolidays>();
const holidayFailureCache = new Map<string, CachedFailure>();

/** Test-only: clear module-level holiday caches between cases. */
export function resetHolidayCachesForTests(): void {
  holidayCache.clear();
  holidayFailureCache.clear();
}

function yearsFromDays(days: Date[]): number[] {
  const years = new Set<number>();
  for (const day of days) {
    if (!Number.isNaN(day.getTime())) years.add(day.getFullYear());
  }
  return [...years].sort((a, b) => a - b);
}

function indexHolidays(items: DailyHoliday[]): Record<string, DailyHoliday[]> {
  const byDate: Record<string, DailyHoliday[]> = {};
  for (const item of items) {
    if (!item.date) continue;
    const key = item.date.slice(0, 10);
    const bucket = byDate[key] ?? [];
    bucket.push(item);
    byDate[key] = bucket;
  }
  return byDate;
}

function mergeHolidayMaps(
  maps: Record<string, DailyHoliday[]>[],
): Record<string, DailyHoliday[]> {
  const merged: Record<string, DailyHoliday[]> = {};
  for (const map of maps) {
    for (const [key, items] of Object.entries(map)) {
      merged[key] = [...(merged[key] ?? []), ...items];
    }
  }
  return merged;
}

/** Fetches country holidays for visible calendar days; failures never block the grid. */
export function useMonthHolidays(enabled: boolean, monthDays: Date[]) {
  const [holidaysByDate, setHolidaysByDate] = useState<Record<string, DailyHoliday[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const forceNextLoadRef = useRef(false);
  const yearKey = useMemo(() => yearsFromDays(monthDays).join(","), [monthDays]);

  const refresh = useCallback(() => {
    forceNextLoadRef.current = true;
    setRefreshTick((tick) => tick + 1);
  }, []);

  useEffect(() => {
    if (!enabled || !yearKey) {
      setHolidaysByDate({});
      setError(null);
      setLoading(false);
      return;
    }
    const years = yearKey.split(",").map((value) => Number(value));
    const force = forceNextLoadRef.current;
    forceNextLoadRef.current = false;
    let cancelled = false;

    const load = async () => {
      setError(null);
      let failureCacheKey = `${yearKey}:settings`;
      try {
        const { weatherLocation } = await fetchSystemSettings();
        if (cancelled) return;
        const location = resolveWeatherLocation(weatherLocation);
        if (!location) {
          setHolidaysByDate({});
          return;
        }
        const cacheKey = `${location}:${yearKey}`;
        failureCacheKey = cacheKey;

        if (force) {
          holidayCache.delete(cacheKey);
          holidayFailureCache.delete(cacheKey);
        } else {
          const cached = holidayCache.get(cacheKey);
          if (cached && cached.expiresAt > Date.now()) {
            setHolidaysByDate(cached.holidaysByDate);
            return;
          }
          const cachedFailure = holidayFailureCache.get(cacheKey);
          if (cachedFailure && cachedFailure.expiresAt > Date.now()) {
            setError(cachedFailure.error);
            return;
          }
        }

        setLoading(true);
        const payloads = await Promise.all(
          years.map((year) => fetchCalendarHolidays(year, location)),
        );
        if (cancelled) return;
        const holidaysByDate = mergeHolidayMaps(payloads.map((payload) => indexHolidays(payload.holidays ?? [])));
        holidayCache.set(cacheKey, {
          holidaysByDate,
          expiresAt: Date.now() + HOLIDAY_CACHE_MS,
        });
        setHolidaysByDate(holidaysByDate);
      } catch (cause) {
        if (!cancelled) {
          const message = toErrorMessage(cause);
          holidayFailureCache.set(failureCacheKey, {
            error: message,
            expiresAt: Date.now() + HOLIDAY_FAILURE_CACHE_MS,
          });
          setError(message);
          setHolidaysByDate({});
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();

    return () => {
      cancelled = true;
    };
  }, [enabled, yearKey, refreshTick]);

  return { holidaysByDate, error, loading, refresh };
}

export function holidayNamesForDay(
  day: Date,
  holidaysByDate: Record<string, DailyHoliday[]>,
): string[] {
  const items = holidaysByDate[dateKey(day)];
  if (!items?.length) return [];
  return items.map((item) => item.localName || item.name).filter(Boolean);
}
