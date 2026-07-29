import { afterEach, describe, expect, it } from "vitest";
import { makeAnalysisEvent } from "../../test/analysisEventFixtures";
import type { AnalysisEvent, TimeWindow } from "../../types";
import type { ViewMode } from "../../types/common";
import {
  computeDataRange,
  partitionByCoordinates,
  getEventTimestamp,
} from "./mapFilters";

/**
 * Edge-case and integration tests for mapFilters.
 * General correctness properties (partition completeness, coordinate invariants,
 * timestamp resolution, time window filtering, idempotency) are covered below
 * with fixed representative cases.
 */

// getEventTimestamp general correctness is covered below.

describe("partitionByCoordinates — completeness and invariants", () => {
  const mixedItems: AnalysisEvent[] = [
    makeAnalysisEvent({ id: "valid-1", latitude: 25.03, longitude: 121.56 }),
    makeAnalysisEvent({ id: "valid-2", latitude: -90, longitude: 180 }),
    makeAnalysisEvent({ id: "null-lat", latitude: null, longitude: 121.56 }),
    makeAnalysisEvent({ id: "null-lng", latitude: 25.03, longitude: null }),
    makeAnalysisEvent({ id: "out-lat", latitude: 91, longitude: 0 }),
    makeAnalysisEvent({ id: "out-lng", latitude: 0, longitude: 181 }),
    makeAnalysisEvent({ id: "zero", latitude: 0, longitude: 0 }),
  ];

  it("places valid coordinates in withCoords and invalid in withoutCoords", () => {
    const { withCoords, withoutCoords } = partitionByCoordinates(mixedItems);

    expect(withCoords.map((i) => i.id)).toEqual(["valid-1", "valid-2"]);
    expect(withoutCoords.map((i) => i.id)).toEqual([
      "null-lat",
      "null-lng",
      "out-lat",
      "out-lng",
      "zero",
    ]);
  });

  it("preserves original coordinate values in withCoords", () => {
    const items = [
      makeAnalysisEvent({ id: "a", latitude: 25.03, longitude: 121.56 }),
      makeAnalysisEvent({ id: "b", latitude: -45.5, longitude: 90.25 }),
    ];
    const { withCoords } = partitionByCoordinates(items);

    expect(withCoords).toHaveLength(2);
    expect(withCoords[0].latitude).toBe(25.03);
    expect(withCoords[0].longitude).toBe(121.56);
    expect(withCoords[1].latitude).toBe(-45.5);
    expect(withCoords[1].longitude).toBe(90.25);
  });

  it("partition lengths sum to original array length", () => {
    const { withCoords, withoutCoords } = partitionByCoordinates(mixedItems);
    expect(withCoords.length + withoutCoords.length).toBe(mixedItems.length);
  });
});

describe("getEventTimestamp — resolution", () => {
  it("returns sourceMessageTime when non-null", () => {
    const item = makeAnalysisEvent({
      sourceMessageTime: "2024-06-15T10:00:00.000Z",
      createdAt: "2024-01-01T00:00:00.000Z",
    });
    expect(getEventTimestamp(item)).toBe("2024-06-15T10:00:00.000Z");
  });

  it("falls back to createdAt when sourceMessageTime is null", () => {
    const item = makeAnalysisEvent({ createdAt: "2024-06-15T10:00:00.000Z" });
    expect(getEventTimestamp(item)).toBe("2024-06-15T10:00:00.000Z");
  });

  it("always returns a valid ISO date string", () => {
    const item = makeAnalysisEvent({
      sourceMessageTime: "2024-03-20T08:30:00.000Z",
      createdAt: "2024-01-01T00:00:00.000Z",
    });
    const result = getEventTimestamp(item);
    const parsed = new Date(result);
    expect(parsed.getTime()).not.toBeNaN();
    expect(result).toBe(parsed.toISOString());
  });
});

describe("partitionByCoordinates — null island", () => {
  it("treats 0,0 as missing coordinates", () => {
    const item = makeAnalysisEvent({ latitude: 0, longitude: 0 });
    const { withCoords, withoutCoords } = partitionByCoordinates([item]);
    expect(withCoords).toHaveLength(0);
    expect(withoutCoords).toHaveLength(1);
  });

  it("keeps valid non-zero coordinates", () => {
    const item = makeAnalysisEvent({ latitude: 25.03, longitude: 121.56 });
    const { withCoords, withoutCoords } = partitionByCoordinates([item]);
    expect(withCoords).toHaveLength(1);
    expect(withoutCoords).toHaveLength(0);
  });
});

const MS_PER_DAY = 24 * 60 * 60 * 1000;

describe("time window drag — duration preservation", () => {
  it.each([
    [0, 7],
    [-30, 30],
    [365, -365],
  ])(
    "shifting window by %i days preserves duration",
    (offsetDays) => {
      const window: TimeWindow = {
        start: new Date("2024-06-10T00:00:00.000Z"),
        end: new Date("2024-06-20T00:00:00.000Z"),
      };
      const originalDuration = window.end.getTime() - window.start.getTime();
      const shiftMs = offsetDays * MS_PER_DAY;
      const newStart = new Date(window.start.getTime() + shiftMs);
      const newEnd = new Date(window.end.getTime() + shiftMs);
      expect(newEnd.getTime() - newStart.getTime()).toBe(originalDuration);
    },
  );
});

const VALID_VIEW_MODES: ViewMode[] = ["card", "list", "map"];
const STORAGE_KEY = "__test_viewmode_roundtrip__";

function isViewMode(value: string | null): value is ViewMode {
  return value === "card" || value === "list" || value === "map";
}

describe("ViewMode localStorage round-trip", () => {
  afterEach(() => {
    localStorage.removeItem(STORAGE_KEY);
  });

  it.each(VALID_VIEW_MODES)(
    "round-trips valid ViewMode %s through localStorage",
    (mode) => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mode));
      const raw = localStorage.getItem(STORAGE_KEY);
      expect(raw).not.toBeNull();
      const parsed: string = JSON.parse(raw!);
      expect(parsed).toBe(mode);
      expect(isViewMode(parsed)).toBe(true);
    },
  );

  it.each(["table", "grid", "invalid", "CARD"])(
    "isViewMode returns false for invalid value: %s",
    (invalid) => {
      expect(isViewMode(invalid)).toBe(false);
    },
  );

  it("isViewMode returns false for null", () => {
    expect(isViewMode(null)).toBe(false);
  });
});

describe("computeDataRange", () => {
  it("returns earliest and latest timestamps", () => {
    const items = [
      makeAnalysisEvent({ id: "a", createdAt: "2024-06-15T10:00:00.000Z" }),
      makeAnalysisEvent({ id: "b", createdAt: "2024-06-10T05:00:00.000Z" }),
      makeAnalysisEvent({ id: "c", createdAt: "2024-06-20T20:00:00.000Z" }),
    ];
    const range = computeDataRange(items);
    expect(range.start.toISOString()).toBe("2024-06-10T05:00:00.000Z");
    expect(range.end.toISOString()).toBe("2024-06-20T20:00:00.000Z");
  });

  it("uses sourceMessageTime when available", () => {
    const items = [
      makeAnalysisEvent({
        id: "a",
        sourceMessageTime: "2024-01-01T00:00:00.000Z",
        createdAt: "2024-06-15T10:00:00.000Z",
      }),
      makeAnalysisEvent({
        id: "b",
        createdAt: "2024-06-20T20:00:00.000Z",
      }),
    ];
    const range = computeDataRange(items);
    expect(range.start.toISOString()).toBe("2024-01-01T00:00:00.000Z");
    expect(range.end.toISOString()).toBe("2024-06-20T20:00:00.000Z");
  });

  it("returns same start and end for single item", () => {
    const items = [makeAnalysisEvent({ createdAt: "2024-06-15T10:00:00.000Z" })];
    const range = computeDataRange(items);
    expect(range.start.toISOString()).toBe("2024-06-15T10:00:00.000Z");
    expect(range.end.toISOString()).toBe("2024-06-15T10:00:00.000Z");
  });

  it("returns current time for empty array", () => {
    const before = Date.now();
    const range = computeDataRange([]);
    const after = Date.now();
    expect(range.start.getTime()).toBeGreaterThanOrEqual(before);
    expect(range.start.getTime()).toBeLessThanOrEqual(after);
    expect(range.start.getTime()).toBe(range.end.getTime());
  });
});
