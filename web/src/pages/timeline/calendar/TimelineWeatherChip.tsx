import { useTranslation } from "react-i18next";

import type { DailyWeather } from "../../../hooks/useMonthWeather";
import { weatherIcon } from "../../../hooks/useMonthWeather";
import { dateKey } from "../../../domain/timeline/dateUtils";

type TimelineWeatherChipProps = {
  day: Date;
  weatherByDate: Record<string, DailyWeather>;
  /** When false, renders nothing even if weather exists (month out-of-month cells). */
  visible?: boolean;
  testId?: string;
};

/** Compact high-temp weather chip for day / week / month calendar headers. */
export function TimelineWeatherChip({
  day,
  weatherByDate,
  visible = true,
  testId,
}: TimelineWeatherChipProps) {
  const { t } = useTranslation("timeline");
  if (!visible) return null;
  const weather = weatherByDate[dateKey(day)];
  if (!weather) return null;
  return (
    <span
      className="im-weather-chip inline-flex shrink-0 items-center gap-0.5 rounded-sm bg-[color-mix(in_srgb,var(--surface-panel)_78%,transparent)] px-0.5 text-[10px] leading-none text-text-secondary"
      aria-label={t("calendar.weatherAria", {
        high: weather.high,
        low: weather.low,
      })}
      title={t("calendar.weatherTitle", {
        high: weather.high,
        low: weather.low,
      })}
      data-testid={testId}
    >
      <span aria-hidden="true">{weatherIcon(weather.code)}</span>
      <span>{weather.high}°</span>
    </span>
  );
}
