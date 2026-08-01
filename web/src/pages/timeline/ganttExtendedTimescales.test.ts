import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  startOfWeek,
  startOfQuarter,
  startOfYear,
  addQuarters,
  buildQuarterWeeks,
  buildYearGanttColumns,
  formatRangeLabel,
  getQuarterNumber,
  type TimelineScale,
} from "../../domain/timeline/dateUtils";
import { computeEventBarPosition } from "./gantt/ganttEventPositioning";
import { getDateTimeLocale, setAppLocale } from "../../i18n/locale";

describe("Quarter column generation", () => {
  const sampleDates = [
    new Date("2024-01-15"),
    new Date("2024-06-01"),
    new Date("2025-09-20"),
  ];

  it("week-start dates fall within natural quarter boundaries", () => {
    for (const date of sampleDates) {
      const quarterStart = startOfQuarter(date);
      const quarterEnd = addQuarters(quarterStart, 1);
      const weeks = buildQuarterWeeks(quarterStart);

      for (const weekStart of weeks) {
        expect(weekStart.getTime()).toBeGreaterThanOrEqual(quarterStart.getTime());
        expect(weekStart.getTime()).toBeLessThan(quarterEnd.getTime());
      }
    }
  });

  it("columns are ordered chronologically with 7-day spacing", () => {
    for (const date of sampleDates) {
      const quarterStart = startOfQuarter(date);
      const weeks = buildQuarterWeeks(quarterStart);
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

      for (let i = 1; i < weeks.length; i++) {
        expect(weeks[i].getTime()).toBeGreaterThan(weeks[i - 1].getTime());
        expect(weeks[i].getTime() - weeks[i - 1].getTime()).toBe(sevenDaysMs);
      }
    }
  });
});

describe("Year column generation", () => {
  const sampleDates = [
    new Date("2023-03-15"),
    new Date("2024-07-01"),
    new Date("2026-12-31"),
  ];

  beforeEach(() => {
    setAppLocale("zh-Hant");
  });

  afterEach(() => {
    setAppLocale("zh-Hant");
  });

  it("always produces exactly 12 month columns", () => {
    for (const date of sampleDates) {
      expect(buildYearGanttColumns(date)).toHaveLength(12);
    }
  });

  it("i-th column corresponds to month (i+1) of the input year with locale-aware label", () => {
    for (const date of sampleDates) {
      const columns = buildYearGanttColumns(date);
      const locale = getDateTimeLocale();

      for (let i = 0; i < 12; i++) {
        expect(columns[i].day.getMonth()).toBe(i);
        expect(columns[i].day.getDate()).toBe(1);
        expect(columns[i].label).toBe(
          new Date(date.getFullYear(), i, 1).toLocaleDateString(locale, { month: "short" }),
        );
        expect(columns[i].day.getFullYear()).toBe(date.getFullYear());
        expect(columns[i].key).toBe(new Date(date.getFullYear(), i, 1).toISOString());
      }
    }
  });

  it("columns are ordered January through December", () => {
    for (const date of sampleDates) {
      const columns = buildYearGanttColumns(date);

      for (let i = 1; i < columns.length; i++) {
        expect(columns[i].day.getTime()).toBeGreaterThan(columns[i - 1].day.getTime());
      }
    }
  });
});

describe("formatRangeLabel for quarter and year scales", () => {
  const sampleDates = [
    new Date("2024-01-15"),
    new Date("2024-06-30"),
    new Date("2025-12-01"),
  ];

  beforeEach(() => {
    setAppLocale("zh-Hant");
  });

  afterEach(() => {
    setAppLocale("zh-Hant");
  });

  it("formatRangeLabel('quarter') matches YYYY Q[1-4] with correct quarter", () => {
    for (const date of sampleDates) {
      const result = formatRangeLabel("quarter", date);
      expect(result).toMatch(/^\d{4} Q[1-4]$/);

      const [yearStr, qPart] = result.split(" ");
      expect(Number(yearStr)).toBe(date.getFullYear());
      expect(Number(qPart.replace("Q", ""))).toBe(getQuarterNumber(date));
    }
  });

  it("formatRangeLabel('year') follows Intl year for the active UI locale", () => {
    for (const date of sampleDates) {
      const result = formatRangeLabel("year", date);
      expect(result).toBe(
        date.toLocaleDateString(getDateTimeLocale(), { year: "numeric" }),
      );
      expect(result).toContain(String(date.getFullYear()));
    }
  });

  it("formatRangeLabel('month') and year labels switch with en locale", () => {
    const date = new Date("2025-05-15");
    setAppLocale("en");
    expect(formatRangeLabel("month", date)).toBe(
      date.toLocaleDateString("en-US", { year: "numeric", month: "long" }),
    );
    expect(formatRangeLabel("year", date)).toBe(
      date.toLocaleDateString("en-US", { year: "numeric" }),
    );
    expect(buildYearGanttColumns(date)[0].label).toBe(
      new Date(2025, 0, 1).toLocaleDateString("en-US", { month: "short" }),
    );
  });
});

describe("Event bar positioning for quarter/year scales", () => {
  it("quarter scale satisfies column bounds for events within the quarter", () => {
    const baseDate = new Date("2024-06-15");
    const quarterStart = startOfQuarter(baseDate);
    const columnCount = buildQuarterWeeks(quarterStart).length;

    for (const [dayOffsetStart, dayOffsetEnd] of [
      [0, 7],
      [14, 30],
      [45, 60],
    ] as const) {
      const startTime = new Date(quarterStart.getTime() + dayOffsetStart * 24 * 60 * 60 * 1000);
      const endTime = new Date(quarterStart.getTime() + dayOffsetEnd * 24 * 60 * 60 * 1000);
      const result = computeEventBarPosition(startTime, endTime, "quarter", quarterStart, columnCount);

      expect(result.startColumn).toBeGreaterThanOrEqual(1);
      expect(result.startColumn).toBeLessThanOrEqual(result.endColumn);
      expect(result.endColumn).toBeLessThanOrEqual(columnCount);
    }
  });

  it("year scale satisfies column bounds and maps month offsets", () => {
    const baseDate = new Date("2024-06-15");
    const yearStart = startOfYear(baseDate);

    for (const monthOffset of [0, 3, 6, 11]) {
      const eventDate = new Date(yearStart.getFullYear(), monthOffset, 15);
      const result = computeEventBarPosition(eventDate, eventDate, "year", yearStart, 12);

      expect(result.startColumn).toBe(monthOffset + 1);
      expect(result.endColumn).toBe(monthOffset + 1);
      expect(result.endColumn).toBeLessThanOrEqual(12);
    }
  });

  it("point events have isPoint=true across all scales including quarter and year", () => {
    const date = new Date("2024-06-15");
    const scales: { scale: TimelineScale; rangeStart: Date; columnCount: number }[] = [
      { scale: "day", rangeStart: new Date(date.getFullYear(), date.getMonth(), date.getDate()), columnCount: 24 },
      { scale: "week", rangeStart: startOfWeek(date), columnCount: 7 },
      {
        scale: "month",
        rangeStart: new Date(date.getFullYear(), date.getMonth(), 1),
        columnCount: new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate(),
      },
      { scale: "quarter", rangeStart: startOfQuarter(date), columnCount: buildQuarterWeeks(startOfQuarter(date)).length },
      { scale: "year", rangeStart: startOfYear(date), columnCount: 12 },
    ];

    for (const { scale, rangeStart, columnCount } of scales) {
      const result = computeEventBarPosition(date, null, scale, rangeStart, columnCount);
      expect(result.isPoint).toBe(true);
      expect(result.startColumn).toBe(result.endColumn);
      expect(result.startColumn).toBeGreaterThanOrEqual(1);
      expect(result.startColumn).toBeLessThanOrEqual(columnCount);
    }
  });
});

describe("Quarter/year scale functions do not throw", () => {
  const date = new Date("2024-06-15");
  const quarterStart = startOfQuarter(date);
  const yearStart = startOfYear(date);
  const columnCount = buildQuarterWeeks(quarterStart).length;

  it("computeEventBarPosition handles quarter and year scales", () => {
    expect(() =>
      computeEventBarPosition(date, date, "quarter", quarterStart, columnCount),
    ).not.toThrow();
    expect(() =>
      computeEventBarPosition(date, null, "quarter", quarterStart, columnCount),
    ).not.toThrow();
    expect(() =>
      computeEventBarPosition(date, date, "year", yearStart, 12),
    ).not.toThrow();
    expect(() =>
      computeEventBarPosition(date, null, "year", yearStart, 12),
    ).not.toThrow();
  });

  it("formatRangeLabel and column builders handle quarter and year", () => {
    expect(() => formatRangeLabel("quarter", date)).not.toThrow();
    expect(() => formatRangeLabel("year", date)).not.toThrow();
    expect(() => buildQuarterWeeks(quarterStart)).not.toThrow();
    expect(() => buildYearGanttColumns(date)).not.toThrow();
  });
});
