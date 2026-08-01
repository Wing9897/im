import { describe, expect, it, beforeEach } from "vitest";

import { makeTimelineItem } from "../../../test/analysisEventFixtures";
import i18n from "../../../i18n";
import { setAppLocale } from "../../../i18n/locale";
import {
  buildTooltipContent,
  computeEventBarPosition,
  filterVisibleEvents,
  truncateEventTitle,
  truncateLabel,
} from "./ganttEventPositioning";
import { startOfDay, startOfWeek } from "../../../domain/timeline/dateUtils";

beforeEach(async () => {
  setAppLocale("zh-Hant");
  await i18n.changeLanguage("zh-Hant");
});

describe("computeEventBarPosition", () => {
  it.each([
    {
      name: "day 9:00–11:00 → cols 10–12",
      scale: "day" as const,
      rangeStart: new Date(2024, 5, 10),
      start: new Date(2024, 5, 10, 9, 0),
      end: new Date(2024, 5, 10, 11, 0),
      columnCount: 24,
      startColumn: 10,
      endColumn: 12,
      visible: true,
      isPoint: false,
    },
    {
      name: "day midnight → cols 1–3",
      scale: "day" as const,
      rangeStart: new Date(2024, 5, 10),
      start: new Date(2024, 5, 10, 0, 0),
      end: new Date(2024, 5, 10, 2, 0),
      columnCount: 24,
      startColumn: 1,
      endColumn: 3,
      visible: true,
      isPoint: false,
    },
    {
      name: "day hour 23 → col 24",
      scale: "day" as const,
      rangeStart: new Date(2024, 5, 10),
      start: new Date(2024, 5, 10, 23, 0),
      end: new Date(2024, 5, 10, 23, 30),
      columnCount: 24,
      startColumn: 24,
      endColumn: 24,
      visible: true,
      isPoint: false,
    },
    {
      name: "week Tue–Thu → cols 2–4",
      scale: "week" as const,
      rangeStart: new Date(2024, 5, 10),
      start: new Date(2024, 5, 11, 10, 0),
      end: new Date(2024, 5, 13, 15, 0),
      columnCount: 7,
      startColumn: 2,
      endColumn: 4,
      visible: true,
      isPoint: false,
    },
    {
      name: "week first day → col 1",
      scale: "week" as const,
      rangeStart: new Date(2024, 5, 10),
      start: new Date(2024, 5, 10, 8, 0),
      end: new Date(2024, 5, 10, 17, 0),
      columnCount: 7,
      startColumn: 1,
      endColumn: 1,
      visible: true,
      isPoint: false,
    },
    {
      name: "month day 5–10 → cols 5–10",
      scale: "month" as const,
      rangeStart: new Date(2024, 5, 1),
      start: new Date(2024, 5, 5, 9, 0),
      end: new Date(2024, 5, 10, 17, 0),
      columnCount: 30,
      startColumn: 5,
      endColumn: 10,
      visible: true,
      isPoint: false,
    },
    {
      name: "month first day → col 1",
      scale: "month" as const,
      rangeStart: new Date(2024, 5, 1),
      start: new Date(2024, 5, 1, 10, 0),
      end: new Date(2024, 5, 1, 12, 0),
      columnCount: 30,
      startColumn: 1,
      endColumn: 1,
      visible: true,
      isPoint: false,
    },
    {
      name: "point at 14:00 → col 15",
      scale: "day" as const,
      rangeStart: new Date(2024, 5, 10),
      start: new Date(2024, 5, 10, 14, 0),
      end: null,
      columnCount: 24,
      startColumn: 15,
      endColumn: 15,
      visible: true,
      isPoint: true,
    },
    {
      name: "point before range clips to col 1 / invisible",
      scale: "day" as const,
      rangeStart: new Date(2024, 5, 10),
      start: new Date(2024, 5, 9, 10, 0),
      end: null,
      columnCount: 24,
      startColumn: 1,
      endColumn: 1,
      visible: false,
      isPoint: true,
    },
  ])("$name", ({ scale, rangeStart, start, end, columnCount, startColumn, endColumn, visible, isPoint }) => {
    const pos = computeEventBarPosition(start, end, scale, rangeStart, columnCount);
    expect(pos).toMatchObject({ startColumn, endColumn, visible, isPoint });
  });

  it("always produces 1 <= startColumn <= endColumn <= columnCount", () => {
    const scenarios = [
      {
        start: new Date(2024, 5, 10, 9, 0),
        end: new Date(2024, 5, 10, 11, 0),
        scale: "day" as const,
        rangeStart: new Date(2024, 5, 10),
        columnCount: 24,
      },
      {
        start: new Date(2024, 5, 11, 10, 0),
        end: new Date(2024, 5, 13, 15, 0),
        scale: "week" as const,
        rangeStart: new Date(2024, 5, 10),
        columnCount: 7,
      },
      {
        start: new Date(2024, 5, 5, 9, 0),
        end: new Date(2024, 5, 10, 17, 0),
        scale: "month" as const,
        rangeStart: new Date(2024, 5, 1),
        columnCount: 30,
      },
    ];

    for (const { start, end, scale, rangeStart, columnCount } of scenarios) {
      const result = computeEventBarPosition(start, end, scale, rangeStart, columnCount);
      expect(result.startColumn).toBeGreaterThanOrEqual(1);
      expect(result.startColumn).toBeLessThanOrEqual(result.endColumn);
      expect(result.endColumn).toBeLessThanOrEqual(columnCount);
      expect(result.isPoint).toBe(false);
    }
  });

  it("maps day-scale hours and week-scale days within visible range", () => {
    const dayStart = startOfDay(new Date(2024, 5, 10));
    for (const [minHour, maxHour] of [
      [0, 2],
      [9, 11],
      [22, 23],
    ] as const) {
      const result = computeEventBarPosition(
        new Date(dayStart.getTime() + minHour * 60 * 60 * 1000),
        new Date(dayStart.getTime() + maxHour * 60 * 60 * 1000),
        "day",
        dayStart,
        24,
      );
      expect(result).toMatchObject({
        visible: true,
        startColumn: minHour + 1,
        endColumn: maxHour + 1,
      });
    }

    const weekStart = startOfWeek(new Date(2024, 5, 10));
    for (const [minDay, maxDay] of [
      [0, 0],
      [1, 3],
      [5, 6],
    ] as const) {
      const result = computeEventBarPosition(
        new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + minDay),
        new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + maxDay),
        "week",
        weekStart,
        7,
      );
      expect(result).toMatchObject({
        visible: true,
        startColumn: minDay + 1,
        endColumn: maxDay + 1,
      });
    }
  });
});

describe("filterVisibleEvents", () => {
  const rangeStart = new Date("2024-06-10T00:00:00.000Z");
  const rangeEnd = new Date("2024-06-17T00:00:00.000Z");

  it.each([
    {
      name: "fully within",
      startTime: "2024-06-12T09:00:00.000Z",
      endTime: "2024-06-13T17:00:00.000Z" as string | null,
      visible: true,
    },
    {
      name: "partial overlap start",
      startTime: "2024-06-08T09:00:00.000Z",
      endTime: "2024-06-11T17:00:00.000Z" as string | null,
      visible: true,
    },
    {
      name: "partial overlap end",
      startTime: "2024-06-16T09:00:00.000Z",
      endTime: "2024-06-20T17:00:00.000Z" as string | null,
      visible: true,
    },
    {
      name: "completely before",
      startTime: "2024-06-01T09:00:00.000Z",
      endTime: "2024-06-05T17:00:00.000Z" as string | null,
      visible: false,
    },
    {
      name: "completely after",
      startTime: "2024-06-20T09:00:00.000Z",
      endTime: "2024-06-22T17:00:00.000Z" as string | null,
      visible: false,
    },
    {
      name: "null endTime at rangeStart",
      startTime: "2024-06-10T00:00:00.000Z",
      endTime: null,
      visible: true,
    },
    {
      name: "null endTime outside",
      startTime: "2024-06-20T10:00:00.000Z",
      endTime: null,
      visible: false,
    },
    {
      name: "ends exactly before rangeStart",
      startTime: "2024-06-08T09:00:00.000Z",
      endTime: "2024-06-09T23:59:59.999Z" as string | null,
      visible: false,
    },
  ])("$name → visible=$visible", ({ startTime, endTime, visible }) => {
    const result = filterVisibleEvents(
      [makeTimelineItem({ startTime, endTime })],
      rangeStart,
      rangeEnd,
    );
    expect(result).toHaveLength(visible ? 1 : 0);
  });
});

describe("truncateLabel / truncateEventTitle", () => {
  it.each([
    { input: "Short", max: 10, expected: "Short" },
    { input: "", max: 5, expected: "" },
    { input: "exact", max: 5, expected: "exact" },
    { input: "Hello World", max: 5, expected: "Hello…" },
    { input: "ABCDEF", max: 3, expected: "ABC…" },
  ])("truncate('$input', $max) → '$expected'", ({ input, max, expected }) => {
    expect(truncateLabel(input, max)).toBe(expected);
    expect(truncateEventTitle(input, max)).toBe(expected);
  });

  it("result length never exceeds maxLength + 1", () => {
    for (const { title, max } of [
      { title: "x", max: 0 },
      { title: "testing long string", max: 5 },
      { title: "中文標題測試", max: 2 },
    ]) {
      expect(truncateLabel(title, max).length).toBeLessThanOrEqual(max + 1);
      expect(truncateEventTitle(title, max).length).toBeLessThanOrEqual(max + 1);
    }
  });
});

describe("buildTooltipContent", () => {
  it("includes all fields for full event data", () => {
    const event = makeTimelineItem({
      title: "Team Meeting",
      startTime: "2024-06-10T09:00:00.000Z",
      endTime: "2024-06-10T11:00:00.000Z",
      location: "Conference Room A",
      participants: ["Alice", "Bob"],
    });

    const content = buildTooltipContent(event);

    expect(content).toContain("Team Meeting");
    expect(content).toContain("—");
    expect(content).toContain("地點：Conference Room A");
    expect(content).toContain("參與者：Alice、Bob");
    expect(content).toContain(new Date(event.startTime).toLocaleString());
  });

  it.each([
    {
      name: "omits location when null",
      overrides: {
        title: "Quick Sync",
        location: null,
        participants: ["Charlie"],
      },
      expectContains: ["Quick Sync", "參與者：Charlie"],
      expectAbsent: ["地點"],
    },
    {
      name: "omits participants when empty",
      overrides: {
        title: "Solo Work",
        location: "Office",
        participants: [] as string[],
      },
      expectContains: ["Solo Work", "地點：Office"],
      expectAbsent: ["參與者"],
    },
  ])("$name", ({ overrides, expectContains, expectAbsent }) => {
    const content = buildTooltipContent(
      makeTimelineItem({
        startTime: "2024-06-10T09:00:00.000Z",
        endTime: "2024-06-10T10:00:00.000Z",
        ...overrides,
      }),
    );
    for (const fragment of expectContains) expect(content).toContain(fragment);
    for (const fragment of expectAbsent) expect(content).not.toContain(fragment);
  });

  it("shows only start time when endTime is null", () => {
    const content = buildTooltipContent(
      makeTimelineItem({
        title: "Deadline",
        startTime: "2024-06-10T17:00:00.000Z",
        endTime: null,
        location: null,
        participants: [],
      }),
    );
    const lines = content.split("\n");
    expect(lines[0]).toBe("Deadline");
    expect(lines[1]).not.toContain("—");
    expect(content).not.toContain("地點");
    expect(content).not.toContain("參與者");
  });
});
