import { apiClient } from "./client";
import type { components } from "./generated/schema";

export type CalendarHolidaysResponse = components["schemas"]["CalendarHolidaysResponse"];
export type CalendarHolidayItem = components["schemas"]["CalendarHolidayItemResponse"];

export type FetchCalendarHolidaysOptions = {
  signal?: AbortSignal;
};

/** Public holidays for the same weather location string (country-level Nager.Date). */
export function fetchCalendarHolidays(
  year: number,
  location: string,
  options?: FetchCalendarHolidaysOptions,
): Promise<CalendarHolidaysResponse> {
  return apiClient.get<CalendarHolidaysResponse>(
    "/api/v1/calendar/holidays",
    { year: String(year), location },
    { signal: options?.signal },
  );
}
