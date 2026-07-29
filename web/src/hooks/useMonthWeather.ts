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

type CachedWeather = {
  expiresAt: number;
  weatherByDate: Record<string, DailyWeather>;
};

const WEATHER_CACHE_MS = 30 * 60 * 1000;
const weatherCache = new Map<string, CachedWeather>();
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

async function fetchWeather(location: string, days: Date[]): Promise<Record<string, DailyWeather>> {
  const { daily } = await fetchWeatherForecast(location, dateKey(days[0]), dateKey(days.at(-1)!));
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

/** Fetches one compact daily forecast per visible month; results are cached by location and range. */
export function useMonthWeather(enabled: boolean, monthDays: Date[]) {
  const [weatherByDate, setWeatherByDate] = useState<Record<string, DailyWeather>>({});
  const [error, setError] = useState<string | null>(null);
  const dayRange = useMemo(
    () => (monthDays.length ? `${dateKey(monthDays[0])}:${dateKey(monthDays.at(-1)!)}` : ""),
    [monthDays],
  );

  useEffect(() => {
    if (!enabled || !dayRange) {
      setWeatherByDate({});
      return;
    }
    let cancelled = false;
    const load = async () => {
      setWeatherByDate({});
      try {
        const { weatherLocation } = await fetchSystemSettings();
        const location = weatherLocation === "system" ? systemLocation() : weatherLocation.trim();
        if (!location) {
          if (!cancelled) setWeatherByDate({});
          return;
        }
        const cacheKey = `${location}:${dayRange}`;
        const cached = weatherCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
          if (!cancelled) {
            setWeatherByDate(cached.weatherByDate);
            setError(null);
          }
          return;
        }
        const weather = await fetchWeather(location, monthDays);
        weatherCache.set(cacheKey, { weatherByDate: weather, expiresAt: Date.now() + WEATHER_CACHE_MS });
        if (!cancelled) {
          setWeatherByDate(weather);
          setError(null);
        }
      } catch (cause) {
        if (!cancelled) {
          setWeatherByDate({});
          setError(toErrorMessage(cause));
        }
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [enabled, dayRange, monthDays]);

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
