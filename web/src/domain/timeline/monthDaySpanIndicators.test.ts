import { describe, expect, it } from "vitest";
import { makeEvent } from "../../test/timelineTestHelpers";
import {
  classifyMonthDaySpan,
  countMonthDaySpanIndicators,
} from "./monthDaySpanIndicators";

describe("monthDaySpanIndicators", () => {
  const multiDay = makeEvent({
    id: "span-1",
    title: "Trip",
    startTime: "2025-01-15T09:00:00",
    endTime: "2025-01-17T18:00:00",
  });

  it("returns null on the start day (chips already cover it)", () => {
    expect(classifyMonthDaySpan(multiDay, new Date(2025, 0, 15))).toBeNull();
  });

  it("classifies middle days as ongoing", () => {
    expect(classifyMonthDaySpan(multiDay, new Date(2025, 0, 16))).toBe("ongoing");
  });

  it("classifies the end day as ending when started earlier", () => {
    expect(classifyMonthDaySpan(multiDay, new Date(2025, 0, 17))).toBe("ending");
  });

  it("ignores single-day events", () => {
    const single = makeEvent({
      id: "single",
      startTime: "2025-01-15T09:00:00",
      endTime: "2025-01-15T17:00:00",
    });
    expect(classifyMonthDaySpan(single, new Date(2025, 0, 15))).toBeNull();
  });

  it("ignores point events (null / missing end)", () => {
    const point = makeEvent({
      id: "point",
      startTime: "2025-01-15T09:00:00",
      endTime: null,
    });
    expect(classifyMonthDaySpan(point, new Date(2025, 0, 15))).toBeNull();
    expect(classifyMonthDaySpan(point, new Date(2025, 0, 16))).toBeNull();
  });

  it("treats midnight-exact end as exclusive last day", () => {
    const exclusive = makeEvent({
      id: "exclusive",
      startTime: "2025-01-15T00:00:00",
      endTime: "2025-01-18T00:00:00",
    });
    expect(classifyMonthDaySpan(exclusive, new Date(2025, 0, 15))).toBeNull();
    expect(classifyMonthDaySpan(exclusive, new Date(2025, 0, 16))).toBe("ongoing");
    expect(classifyMonthDaySpan(exclusive, new Date(2025, 0, 17))).toBe("ending");
    expect(classifyMonthDaySpan(exclusive, new Date(2025, 0, 18))).toBeNull();
  });

  it("counts multiple spanning events per day", () => {
    const events = [
      multiDay,
      makeEvent({
        id: "span-2",
        startTime: "2025-01-14T08:00:00",
        endTime: "2025-01-16T12:00:00",
      }),
      makeEvent({
        id: "span-3",
        startTime: "2025-01-10T08:00:00",
        endTime: "2025-01-20T12:00:00",
      }),
      makeEvent({
        id: "starts-today",
        startTime: "2025-01-16T09:00:00",
        endTime: "2025-01-18T09:00:00",
      }),
    ];

    expect(countMonthDaySpanIndicators(events, new Date(2025, 0, 16))).toEqual({
      ongoing: 2, // span-1 middle + span-3 middle; span-2 ends today; starts-today excluded
      ending: 1,
    });
  });

  it("returns zeros when no spanning activity touches the day", () => {
    expect(countMonthDaySpanIndicators([multiDay], new Date(2025, 0, 20))).toEqual({
      ongoing: 0,
      ending: 0,
    });
  });
});
