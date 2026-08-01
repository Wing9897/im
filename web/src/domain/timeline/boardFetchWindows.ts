/**
 * Shared ISO windows for board timed-event fetchers (gantt / calendar widgets).
 */

import { addDays, addMonths, startOfDay, startOfMonth } from "./dateUtils";

/** Current local calendar month (no padding) — gantt events widget. */
export function currentMonthWindowIso(): { startDate: string; endDate: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { startDate: start.toISOString(), endDate: end.toISOString() };
}

/** Month grid window with ±7 day pad so the 42-day month view is covered. */
export function paddedMonthWindowIso(): { startDate: string; endDate: string } {
  const start = startOfMonth(new Date());
  const paddedStart = new Date(start);
  paddedStart.setDate(paddedStart.getDate() - 7);
  const end = addMonths(start, 1);
  end.setDate(end.getDate() + 7);
  return { startDate: paddedStart.toISOString(), endDate: end.toISOString() };
}

/** ~3-day window around today for the day schedule widget (yesterday–tomorrow). */
export function dayWindowIso(): { startDate: string; endDate: string } {
  const today = startOfDay(new Date());
  const start = addDays(today, -1);
  const end = addDays(today, 2);
  return { startDate: start.toISOString(), endDate: end.toISOString() };
}
