import { apiClient } from "./client";

type WeatherForecastResponse = {
  daily: {
    time?: string[];
    weather_code?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
  };
};

export function fetchWeatherForecast(
  location: string,
  startDate: string,
  endDate: string,
): Promise<WeatherForecastResponse> {
  const params = new URLSearchParams({
    location,
    start_date: startDate,
    end_date: endDate,
  });
  return apiClient.get<WeatherForecastResponse>(`/api/v1/weather/forecast?${params}`);
}
