import { describe, expect, it } from "vitest";

import type { UserEvent } from "../../api/userEvents";
import {
  countActiveScheduleFilters,
  DEFAULT_SCHEDULE_FILTERS,
  filterScheduleEntriesByDate,
  normalizeScheduleFilters,
  recurringSeriesInDateRange,
  scheduleDateQueryWindow,
  scheduleFiltersAreActive,
} from "./scheduleFilters";
import type { ScheduleRecurringItem } from "./useScheduleRecurringFeed";

function series(
  partial: Partial<ScheduleRecurringItem> & Pick<ScheduleRecurringItem, "id" | "name">,
): ScheduleRecurringItem {
  return {
    description: null,
    rrule: "FREQ=DAILY",
    eventStartTime: "2026-03-01T09:00:00",
    eventEndTime: null,
    eventIsAllDay: false,
    eventLocation: null,
    eventDescription: null,
    eventTimezone: null,
    eventExdates: [],
    eventRdates: [],
    icsUid: null,
    icsSource: null,
    isActive: true,
    worksetId: "__general__",
    parentTaskId: null,
    itemId: null,
    createdAt: "2026-03-01T08:00:00Z",
    updatedAt: "2026-03-01T08:00:00Z",
    ...partial,
  };
}

function event(partial: Partial<UserEvent> & Pick<UserEvent, "id" | "title">): UserEvent {
  return {
    body: "",
    startTime: "2026-04-10T09:00:00Z",
    endTime: null,
    location: null,
    origin: "manual",
    isAllDay: false,
    worksetId: "__general__",
    taskId: "",
    source: "user",
    dismissed: false,
    important: false,
    kind: "normal",
    createdAt: "2026-04-10T08:00:00Z",
    updatedAt: "2026-04-10T08:00:00Z",
    ...partial,
  };
}

describe("scheduleFilters", () => {
  it("normalizes unknown type/workset/date back to defaults", () => {
    expect(normalizeScheduleFilters({ type: "nope", worksetId: 1, startDay: "x", endDay: "2026-13-40" })).toEqual(
      DEFAULT_SCHEDULE_FILTERS,
    );
    expect(scheduleFiltersAreActive(DEFAULT_SCHEDULE_FILTERS)).toBe(false);
    expect(scheduleFiltersAreActive({ ...DEFAULT_SCHEDULE_FILTERS, type: "oneOff" })).toBe(true);
    expect(countActiveScheduleFilters(DEFAULT_SCHEDULE_FILTERS)).toBe(0);
    expect(
      countActiveScheduleFilters({
        type: "oneOff",
        worksetId: "ws-ops",
        startDay: "2026-08-01",
        endDay: "2026-08-31",
      }),
    ).toBe(3);
  });

  it("builds an inclusive local ISO window and swaps inverted days", () => {
    const window = scheduleDateQueryWindow("2026-08-10", "2026-08-01");
    expect(window.startTime).toBe(new Date("2026-08-01T00:00:00").toISOString());
    expect(window.endTime).toBe(new Date("2026-08-10T23:59:59.999").toISOString());
    expect(scheduleDateQueryWindow("2026-08-01", "")).toEqual({
      startTime: new Date("2026-08-01T00:00:00").toISOString(),
    });
  });

  it("treats open-ended recurring series as overlapping any range after dtstart", () => {
    const daily = series({ id: "rec-1", name: "Standup" });
    expect(recurringSeriesInDateRange(daily, "2026-08-01", "2026-08-31")).toBe(true);
    expect(recurringSeriesInDateRange(daily, "2026-01-01", "2026-01-31")).toBe(false);
    expect(
      recurringSeriesInDateRange(
        series({ id: "rec-2", name: "Closed", eventStartTime: "2026-03-01", eventEndTime: "2026-03-15" }),
        "2026-03-10",
        "2026-03-20",
      ),
    ).toBe(true);
  });

  it("filters merged entries by inclusive date range", () => {
    const filtered = filterScheduleEntriesByDate(
      [
        { kind: "oneOff", event: event({ id: "ue-in", title: "In", startTime: "2026-08-05T10:00:00Z" }) },
        { kind: "oneOff", event: event({ id: "ue-out", title: "Out", startTime: "2026-07-01T10:00:00Z" }) },
        { kind: "recurring", series: series({ id: "rec-1", name: "Daily" }) },
      ],
      "2026-08-01",
      "2026-08-31",
    );
    expect(filtered.map((row) => (row.kind === "oneOff" ? row.event.id : row.series.id))).toEqual([
      "ue-in",
      "rec-1",
    ]);
  });
});
