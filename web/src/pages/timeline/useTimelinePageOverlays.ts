import { useMemo } from "react";

import { showMonthDatesRevealChrome } from "../../domain/timeline/monthCardSources";
import { useMonthHolidays } from "../../hooks/useMonthHolidays";
import { useMonthWeather } from "../../hooks/useMonthWeather";
import { useMonthDateReveal } from "./calendar/useMonthDateReveal";
import type { useTimelinePageContainer } from "./useTimelinePageContainer";

type Container = ReturnType<typeof useTimelinePageContainer>;

type Args = {
  viewMode: Container["sources"]["viewMode"];
  monthLayout: Container["sources"]["monthLayout"];
  navigation: Pick<
    Container["navigation"],
    "timeScale" | "weekDays" | "rangeStart" | "monthDays"
  >;
};

/** Calendar weather / holiday chips plus month date-reveal chrome. */
export function useTimelinePageOverlays({ viewMode, monthLayout, navigation }: Args) {
  const weatherEnabled = viewMode === "calendar";
  const weatherDays = useMemo(() => {
    if (!weatherEnabled) return [] as Date[];
    if (navigation.timeScale === "week") return navigation.weekDays;
    if (navigation.timeScale === "day") return [navigation.rangeStart];
    return navigation.monthDays;
  }, [
    weatherEnabled,
    navigation.timeScale,
    navigation.weekDays,
    navigation.rangeStart,
    navigation.monthDays,
  ]);
  const {
    weatherByDate,
    loading: weatherLoading,
    refresh: refreshWeather,
  } = useMonthWeather(weatherEnabled, weatherDays);
  const {
    holidaysByDate,
    loading: holidaysLoading,
    refresh: refreshHolidays,
  } = useMonthHolidays(weatherEnabled, weatherDays);
  const overlayLoading = weatherLoading || holidaysLoading;
  const datesReveal = useMonthDateReveal();
  const showMonthDatesReveal = showMonthDatesRevealChrome(
    viewMode,
    navigation.timeScale,
    monthLayout,
  );

  return {
    weatherEnabled,
    weatherByDate,
    holidaysByDate,
    overlayLoading,
    refreshWeather,
    refreshHolidays,
    datesReveal,
    showMonthDatesReveal,
  };
}
