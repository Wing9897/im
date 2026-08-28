import { RefreshCw } from "lucide-react";
import { PillButton } from "../../components/ui";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { fetchSystemSettings } from "../../api/config";
import { fetchWeatherForecast } from "../../api/weather";
import { useErrorToast } from "../../hooks/useErrorToast";
import {
  resolveWeatherLocation,
  weatherIcon,
  type DailyWeather,
} from "../../hooks/useMonthWeather";
import { useBoardWidgetHeaderActions } from "../BoardWidgetFrame";
import { BoardWidgetShell } from "../BoardWidgetStatus";
import { BOARD_POLL_MS, useBoardWidgetPoll } from "../useBoardWidgetPoll";
import type { BoardWidgetProps } from "../types";
import { getDateTimeLocale } from "../../i18n/locale";
import i18n from "../../i18n";
import { dateKey } from "../../utils/dateFormat";

/** Today + next 6 days (7 total); upcoming days wrap in a 3-column forecast grid. */
const FORECAST_DAYS = 7;

type BoardWeatherDay = DailyWeather & { date: string };

type BoardWeatherSnapshot = {
  location: string;
  days: BoardWeatherDay[];
};

function addDays(base: Date, offset: number): Date {
  const next = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  next.setDate(next.getDate() + offset);
  return next;
}

function weekdayLabel(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return date;
  return new Date(year, month - 1, day).toLocaleDateString(getDateTimeLocale(), {
    weekday: "short",
  });
}

function weatherLabel(code: number): string {
  if (code === 0) return String(i18n.t("board:weather.clear"));
  if (code <= 2) return String(i18n.t("board:weather.cloudy"));
  if (code === 3) return String(i18n.t("board:weather.overcast"));
  if (code <= 48) return String(i18n.t("board:weather.fog"));
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
    return String(i18n.t("board:weather.rain"));
  }
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) {
    return String(i18n.t("board:weather.snow"));
  }
  if (code >= 95) return String(i18n.t("board:weather.thunder"));
  return String(i18n.t("board:weather.generic"));
}

async function loadBoardWeather(): Promise<BoardWeatherSnapshot> {
  const { weatherLocation } = await fetchSystemSettings();
  const location = resolveWeatherLocation(weatherLocation);
  if (!location) {
    return { location: "", days: [] };
  }

  const start = addDays(new Date(), 0);
  const end = addDays(start, FORECAST_DAYS - 1);
  const { daily } = await fetchWeatherForecast(location, dateKey(start), dateKey(end));
  if (!daily?.time || !daily.weather_code || !daily.temperature_2m_max || !daily.temperature_2m_min) {
    return { location, days: [] };
  }

  const days: BoardWeatherDay[] = daily.time.slice(0, FORECAST_DAYS).map((date, index) => ({
    date,
    code: daily.weather_code![index],
    high: Math.round(daily.temperature_2m_max![index]),
    low: Math.round(daily.temperature_2m_min![index]),
  }));

  return { location, days };
}

/** Compact region weather from settings — today summary + multi-day forecast grid. */
export function WeatherBoardWidget({ active = true }: BoardWidgetProps) {
  const { t } = useTranslation();
  const fetcher = useCallback(() => loadBoardWeather(), []);
  const { data, error, loading, refresh } = useBoardWidgetPoll<BoardWeatherSnapshot>(
    fetcher,
    BOARD_POLL_MS.weather,
    { active },
  );

  useErrorToast(error, t("board:weather.errorPrefix"));

  const headerActions = useMemo(
    () => (
      <PillButton
        padding="square"
        className="board-widget-frame__btn"
        title={t("board:weather.refresh")}
        aria-label={t("board:weather.refresh")}
        data-testid="board-weather-refresh"
        onClick={refresh}
      >
        <RefreshCw size={12} strokeWidth={2} aria-hidden="true" />
      </PillButton>
    ),
    [refresh, t],
  );
  useBoardWidgetHeaderActions(headerActions);

  const today = data?.days[0] ?? null;
  const upcoming = data?.days.slice(1) ?? [];

  return (
    <div className="board-widget-body board-widget-weather" data-testid="board-weather-widget">
      <BoardWidgetShell
        active={active}
        pausedLabel={t("board:common.paused", { name: t("board:weather.pausedName") })}
        pausedTestId="board-weather-paused"
        loading={loading && !data}
        empty={Boolean(data) && data!.days.length === 0}
        emptyLabel={
          data?.location ? t("board:weather.emptyForecast") : t("board:weather.emptyLocation")
        }
      >
        {data && today ? (
          <div className="board-weather">
            <div className="board-weather__today" data-testid="board-weather-today">
              <div className="board-weather__today-main">
                <span className="board-weather__icon" aria-hidden="true">
                  {weatherIcon(today.code)}
                </span>
                <div className="board-weather__today-temps">
                  <span className="board-weather__high">{today.high}°</span>
                  <span className="board-weather__low">{today.low}°</span>
                </div>
              </div>
              <div className="board-weather__today-meta">
                <span className="board-weather__label">{weatherLabel(today.code)}</span>
                <span className="board-weather__location" title={data.location}>
                  {data.location}
                </span>
              </div>
            </div>
            {upcoming.length > 0 ? (
              <ul className="board-weather__forecast" data-testid="board-weather-forecast">
                {upcoming.map((day) => (
                  <li key={day.date} className="board-weather__day">
                    <span className="board-weather__weekday">{weekdayLabel(day.date)}</span>
                    <span className="board-weather__day-icon" aria-hidden="true">
                      {weatherIcon(day.code)}
                    </span>
                    <span className="board-weather__day-temps">
                      {day.high}°/{day.low}°
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </BoardWidgetShell>
    </div>
  );
}
