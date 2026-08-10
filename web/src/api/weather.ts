import { apiClient } from "./client";

type WeatherForecastResponse = {
  daily: {
    time?: string[];
    weather_code?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
  };
};

export type FetchWeatherForecastOptions = {
  signal?: AbortSignal;
  /** When true, server bypasses its successful forecast TTL cache. */
  force?: boolean;
};

export function fetchWeatherForecast(
  location: string,
  startDate: string,
  endDate: string,
  options?: FetchWeatherForecastOptions | AbortSignal,
): Promise<WeatherForecastResponse> {
  const normalized =
    options instanceof AbortSignal ? { signal: options } : (options ?? {});
  return apiClient.get<WeatherForecastResponse>(
    "/api/v1/weather/forecast",
    {
      location,
      startDate,
      endDate,
      ...(normalized.force ? { force: "true" } : {}),
    },
    { signal: normalized.signal },
  );
}
