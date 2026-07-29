import { describe, expect, it, beforeEach } from "vitest";

import { makeTimelineItem } from "../../../test/analysisEventFixtures";
import i18n from "../../../i18n";
import { setAppLocale } from "../../../i18n/locale";
import { truncateLabel } from "./ganttPositioning";
import {
  buildTooltipContent,
  computeEventBarPosition,
  filterVisibleEvents,
  truncateEventTitle,
} from "./ganttEventPositioning";
import { startOfDay, startOfWeek } from "../../../domain/timeline/dateUtils";

beforeEach(async () => {
  setAppLocale("zh-Hant");
  await i18n.changeLanguage("zh-Hant");
});

describe("computeEventBarPosition", () => {
  describe("day scale (24 columns = hours)", () => {
    it("maps event from 9:00 to 11:00 to startColumn=10, endColumn=12", () => {
      const rangeStart = new Date(2024, 5, 10); // June 10, 2024 midnight
      const startTime = new Date(2024, 5, 10, 9, 0); // 9:00
      const endTime = new Date(2024, 5, 10, 11, 0); // 11:00

      const pos = computeEventBarPosition(startTime, endTime, "day", rangeStart, 24);

      expect(pos.startColumn).toBe(10); // hour 9 → column 10 (0-based hour + 1)
      expect(pos.endColumn).toBe(12); // hour 11 → column 12
      expect(pos.visible).toBe(true);
      expect(pos.isPoint).toBe(false);
    });

    it("handles event at midnight (hour 0) → column 1", () => {
      const rangeStart = new Date(2024, 5, 10);
      const startTime = new Date(2024, 5, 10, 0, 0);
      const endTime = new Date(2024, 5, 10, 2, 0);

      const pos = computeEventBarPosition(startTime, endTime, "day", rangeStart, 24);

      expect(pos.startColumn).toBe(1);
      expect(pos.endColumn).toBe(3);
    });

    it("handles event at end of day (hour 23) → column 24", () => {
      const rangeStart = new Date(2024, 5, 10);
      const startTime = new Date(2024, 5, 10, 23, 0);
      const endTime = new Date(2024, 5, 10, 23, 30);

      const pos = computeEventBarPosition(startTime, endTime, "day", rangeStart, 24);

      expect(pos.startColumn).toBe(24);
      expect(pos.endColumn).toBe(24);
    });
  });

  describe("week scale (7 columns = days)", () => {
    it("maps event on Tuesday to Thursday → correct columns", () => {
      // rangeStart is Monday June 10, 2024
      const rangeStart = new Date(2024, 5, 10);
      // Tuesday June 11 → day offset 1 → column 2
      const startTime = new Date(2024, 5, 11, 10, 0);
      // Thursday June 13 → day offset 3 → column 4
      const endTime = new Date(2024, 5, 13, 15, 0);

      const pos = computeEventBarPosition(startTime, endTime, "week", rangeStart, 7);

      expect(pos.startColumn).toBe(2);
      expect(pos.endColumn).toBe(4);
      expect(pos.visible).toBe(true);
      expect(pos.isPoint).toBe(false);
    });

    it("maps event on first day of week → column 1", () => {
      const rangeStart = new Date(2024, 5, 10); // Monday
      const startTime = new Date(2024, 5, 10, 8, 0);
      const endTime = new Date(2024, 5, 10, 17, 0);

      const pos = computeEventBarPosition(startTime, endTime, "week", rangeStart, 7);

      expect(pos.startColumn).toBe(1);
      expect(pos.endColumn).toBe(1);
    });
  });

  describe("month scale (variable columns = days in month)", () => {
    it("maps event from day 5 to day 10 → startColumn=5, endColumn=10", () => {
      // rangeStart is June 1, 2024
      const rangeStart = new Date(2024, 5, 1);
      // June 5 → day offset 4 → column 5
      const startTime = new Date(2024, 5, 5, 9, 0);
      // June 10 → day offset 9 → column 10
      const endTime = new Date(2024, 5, 10, 17, 0);

      const pos = computeEventBarPosition(startTime, endTime, "month", rangeStart, 30);

      expect(pos.startColumn).toBe(5);
      expect(pos.endColumn).toBe(10);
      expect(pos.visible).toBe(true);
      expect(pos.isPoint).toBe(false);
    });

    it("maps event on first day of month → column 1", () => {
      const rangeStart = new Date(2024, 5, 1);
      const startTime = new Date(2024, 5, 1, 10, 0);
      const endTime = new Date(2024, 5, 1, 12, 0);

      const pos = computeEventBarPosition(startTime, endTime, "month", rangeStart, 30);

      expect(pos.startColumn).toBe(1);
      expect(pos.endColumn).toBe(1);
    });
  });

  describe("column bounds invariants", () => {
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
      }
    });

    it("when endTime is null, isPoint is true and startColumn equals endColumn", () => {
      const rangeStart = new Date(2024, 5, 10);
      const startTime = new Date(2024, 5, 10, 14, 0);

      const result = computeEventBarPosition(startTime, null, "day", rangeStart, 24);

      expect(result.isPoint).toBe(true);
      expect(result.startColumn).toBe(result.endColumn);
      expect(result.startColumn).toBeGreaterThanOrEqual(1);
      expect(result.endColumn).toBeLessThanOrEqual(24);
    });

    it("when endTime is provided, isPoint is false", () => {
      const rangeStart = new Date(2024, 5, 10);
      const startTime = new Date(2024, 5, 10, 9, 0);
      const endTime = new Date(2024, 5, 10, 11, 0);

      const result = computeEventBarPosition(startTime, endTime, "day", rangeStart, 24);

      expect(result.isPoint).toBe(false);
    });

    it("maps day-scale timestamps within visible range to correct hour columns", () => {
      const baseDate = new Date(2024, 5, 10);
      const rangeStart = startOfDay(baseDate);
      const columnCount = 24;

      for (const [minHour, maxHour] of [
        [0, 2],
        [9, 11],
        [22, 23],
      ] as const) {
        const startTime = new Date(rangeStart.getTime() + minHour * 60 * 60 * 1000);
        const endTime = new Date(rangeStart.getTime() + maxHour * 60 * 60 * 1000);

        const result = computeEventBarPosition(startTime, endTime, "day", rangeStart, columnCount);

        expect(result.visible).toBe(true);
        expect(result.startColumn).toBe(minHour + 1);
        expect(result.endColumn).toBe(maxHour + 1);
      }
    });

    it("maps week-scale timestamps within visible range to correct day columns", () => {
      const baseDate = new Date(2024, 5, 10);
      const rangeStart = startOfWeek(baseDate);
      const columnCount = 7;

      for (const [minDay, maxDay] of [
        [0, 0],
        [1, 3],
        [5, 6],
      ] as const) {
        const startTime = new Date(
          rangeStart.getFullYear(),
          rangeStart.getMonth(),
          rangeStart.getDate() + minDay,
        );
        const endTime = new Date(
          rangeStart.getFullYear(),
          rangeStart.getMonth(),
          rangeStart.getDate() + maxDay,
        );

        const result = computeEventBarPosition(startTime, endTime, "week", rangeStart, columnCount);

        expect(result.visible).toBe(true);
        expect(result.startColumn).toBe(minDay + 1);
        expect(result.endColumn).toBe(maxDay + 1);
      }
    });
  });

  describe("null endTime (point event)", () => {
    it("returns isPoint=true and startColumn=endColumn", () => {
      const rangeStart = new Date(2024, 5, 10);
      const startTime = new Date(2024, 5, 10, 14, 0); // 2pm → column 15

      const pos = computeEventBarPosition(startTime, null, "day", rangeStart, 24);

      expect(pos.isPoint).toBe(true);
      expect(pos.startColumn).toBe(pos.endColumn);
      expect(pos.startColumn).toBe(15);
      expect(pos.visible).toBe(true);
    });

    it("clips point event outside range to boundary", () => {
      const rangeStart = new Date(2024, 5, 10);
      // Event before range start → column would be negative
      const startTime = new Date(2024, 5, 9, 10, 0);

      const pos = computeEventBarPosition(startTime, null, "day", rangeStart, 24);

      expect(pos.isPoint).toBe(true);
      expect(pos.startColumn).toBe(1); // clipped to minimum
      expect(pos.visible).toBe(false);
    });
  });
});


describe("filterVisibleEvents", () => {
  const rangeStart = new Date("2024-06-10T00:00:00.000Z");
  const rangeEnd = new Date("2024-06-17T00:00:00.000Z");

  it("includes event fully within range", () => {
    const events = [
      makeTimelineItem({
        startTime: "2024-06-12T09:00:00.000Z",
        endTime: "2024-06-13T17:00:00.000Z",
      }),
    ];

    const result = filterVisibleEvents(events, rangeStart, rangeEnd);
    expect(result).toHaveLength(1);
  });

  it("includes event partially overlapping start of range", () => {
    const events = [
      makeTimelineItem({
        startTime: "2024-06-08T09:00:00.000Z",
        endTime: "2024-06-11T17:00:00.000Z",
      }),
    ];

    const result = filterVisibleEvents(events, rangeStart, rangeEnd);
    expect(result).toHaveLength(1);
  });

  it("includes event partially overlapping end of range", () => {
    const events = [
      makeTimelineItem({
        startTime: "2024-06-16T09:00:00.000Z",
        endTime: "2024-06-20T17:00:00.000Z",
      }),
    ];

    const result = filterVisibleEvents(events, rangeStart, rangeEnd);
    expect(result).toHaveLength(1);
  });

  it("excludes event completely before range", () => {
    const events = [
      makeTimelineItem({
        startTime: "2024-06-01T09:00:00.000Z",
        endTime: "2024-06-05T17:00:00.000Z",
      }),
    ];

    const result = filterVisibleEvents(events, rangeStart, rangeEnd);
    expect(result).toHaveLength(0);
  });

  it("excludes event completely after range", () => {
    const events = [
      makeTimelineItem({
        startTime: "2024-06-20T09:00:00.000Z",
        endTime: "2024-06-22T17:00:00.000Z",
      }),
    ];

    const result = filterVisibleEvents(events, rangeStart, rangeEnd);
    expect(result).toHaveLength(0);
  });

  it("includes event with null endTime at boundary (startTime equals rangeStart)", () => {
    const events = [
      makeTimelineItem({
        startTime: "2024-06-10T00:00:00.000Z",
        endTime: null,
      }),
    ];

    // endTime is null → uses startTime as end, so end >= rangeStart is true
    // start < rangeEnd is true (June 10 < June 17)
    const result = filterVisibleEvents(events, rangeStart, rangeEnd);
    expect(result).toHaveLength(1);
  });

  it("excludes event with null endTime completely outside range", () => {
    const events = [
      makeTimelineItem({
        startTime: "2024-06-20T10:00:00.000Z",
        endTime: null,
      }),
    ];

    // start (June 20) < rangeEnd (June 17) is false → excluded
    const result = filterVisibleEvents(events, rangeStart, rangeEnd);
    expect(result).toHaveLength(0);
  });

  it("excludes event ending exactly at rangeStart (boundary: end < rangeStart)", () => {
    const events = [
      makeTimelineItem({
        startTime: "2024-06-08T09:00:00.000Z",
        endTime: "2024-06-09T23:59:59.999Z",
      }),
    ];

    // end (June 9 23:59) >= rangeStart (June 10 00:00) is false → excluded
    const result = filterVisibleEvents(events, rangeStart, rangeEnd);
    expect(result).toHaveLength(0);
  });
});

describe("truncateEventTitle", () => {
  it("returns title unchanged when title.length <= maxLength", () => {
    expect(truncateEventTitle("Short", 10)).toBe("Short");
    expect(truncateEventTitle("", 5)).toBe("");
    expect(truncateEventTitle("exact", 5)).toBe("exact");
  });

  it("returns first maxLength characters followed by ellipsis when title is longer", () => {
    expect(truncateEventTitle("Hello World", 5)).toBe("Hello…");
    expect(truncateEventTitle("ABCDEF", 3)).toBe("ABC…");
  });

  it("result length never exceeds maxLength + 1", () => {
    const cases = [
      { title: "x", max: 0 },
      { title: "testing long string", max: 5 },
      { title: "中文標題測試", max: 2 },
    ];
    for (const { title, max } of cases) {
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
    expect(content).toContain("—"); // time range separator
    expect(content).toContain("地點：Conference Room A");
    expect(content).toContain("參與者：Alice、Bob");
  });

  it("omits location line when location is null", () => {
    const event = makeTimelineItem({
      title: "Quick Sync",
      startTime: "2024-06-10T09:00:00.000Z",
      endTime: "2024-06-10T10:00:00.000Z",
      location: null,
      participants: ["Charlie"],
    });

    const content = buildTooltipContent(event);

    expect(content).toContain("Quick Sync");
    expect(content).not.toContain("地點");
    expect(content).toContain("參與者：Charlie");
  });

  it("omits participants line when participants is empty", () => {
    const event = makeTimelineItem({
      title: "Solo Work",
      startTime: "2024-06-10T14:00:00.000Z",
      endTime: "2024-06-10T16:00:00.000Z",
      location: "Office",
      participants: [],
    });

    const content = buildTooltipContent(event);

    expect(content).toContain("Solo Work");
    expect(content).toContain("地點：Office");
    expect(content).not.toContain("參與者");
  });

  it("shows only start time when endTime is null", () => {
    const event = makeTimelineItem({
      title: "Deadline",
      startTime: "2024-06-10T17:00:00.000Z",
      endTime: null,
      location: null,
      participants: [],
    });

    const content = buildTooltipContent(event);
    const lines = content.split("\n");

    expect(lines[0]).toBe("Deadline");
    // Second line should be just the start time (no "—" separator)
    expect(lines[1]).not.toContain("—");
    expect(content).not.toContain("地點");
    expect(content).not.toContain("參與者");
  });

  it("contains formatted start time in tooltip", () => {
    const event = makeTimelineItem({
      title: "Sync",
      startTime: "2024-06-10T09:00:00.000Z",
      endTime: "2024-06-10T10:00:00.000Z",
    });
    const content = buildTooltipContent(event);
    const startStr = new Date(event.startTime).toLocaleString();
    expect(content).toContain(startStr);
  });

  it("omits location line when location is null", () => {
    const event = makeTimelineItem({ location: null });
    expect(buildTooltipContent(event)).not.toContain("地點：");
  });

  it("omits participants line when participants is empty", () => {
    const event = makeTimelineItem({ participants: [] });
    expect(buildTooltipContent(event)).not.toContain("參與者：");
  });
});

describe("truncateLabel", () => {
  it("returns name unchanged when name.length <= maxLength", () => {
    expect(truncateLabel("Short", 10)).toBe("Short");
    expect(truncateLabel("", 5)).toBe("");
    expect(truncateLabel("exact", 5)).toBe("exact");
  });

  it("returns first maxLength characters followed by ellipsis when name is longer", () => {
    expect(truncateLabel("Hello World", 5)).toBe("Hello…");
    expect(truncateLabel("ABCDEF", 3)).toBe("ABC…");
  });

  it("result length is always <= maxLength + 1", () => {
    const cases = [
      { name: "x", max: 0 },
      { name: "testing long string", max: 5 },
      { name: "中文任務名稱", max: 2 },
    ];
    for (const { name, max } of cases) {
      expect(truncateLabel(name, max).length).toBeLessThanOrEqual(max + 1);
    }
  });
});
