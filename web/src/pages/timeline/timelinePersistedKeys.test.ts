import { describe, it, expect, beforeEach } from "vitest";

import {
  TIMELINE_TIME_CURSOR_STORAGE_KEY,
  TIMELINE_TIME_SCALE_STORAGE_KEY,
  TIMELINE_VIEW_MODE_STORAGE_KEY,
} from "./timelinePersistedKeys";

/**
 * localStorage key-independence tests for timeline persisted state.
 * Does not invoke useTimelinePageContainer — only verifies key isolation.
 */

const VIEW_MODE_KEY = TIMELINE_VIEW_MODE_STORAGE_KEY;
const TIME_SCALE_KEY = TIMELINE_TIME_SCALE_STORAGE_KEY;
const TIME_CURSOR_KEY = TIMELINE_TIME_CURSOR_STORAGE_KEY;

const VIEW_MODES = ["calendar", "gantt"] as const;
const TIME_SCALES = ["day", "week", "month"] as const;

// Generate all combinations of view mode × time scale
const viewModeTimeScaleCombinations = VIEW_MODES.flatMap((viewMode) =>
  TIME_SCALES.map((timeScale) => ({ viewMode, timeScale })),
);

// Generate all view mode transition pairs × time scale
const viewModeTransitions = VIEW_MODES.flatMap((initialViewMode) =>
  VIEW_MODES.flatMap((newViewMode) =>
    TIME_SCALES.map((timeScale) => ({ initialViewMode, newViewMode, timeScale })),
  ),
);

describe("timeline persisted keys independence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("switching viewMode does not modify timeScale in localStorage", () => {
    it.each(viewModeTransitions)(
      "timeScale=$timeScale remains unchanged when viewMode switches from $initialViewMode to $newViewMode",
      ({ initialViewMode, newViewMode, timeScale }) => {
        // Arrange: persist timeScale and an initial viewMode
        localStorage.setItem(TIME_SCALE_KEY, JSON.stringify(timeScale));
        localStorage.setItem(VIEW_MODE_KEY, JSON.stringify(initialViewMode));

        // Act: switch viewMode to a new value
        localStorage.setItem(VIEW_MODE_KEY, JSON.stringify(newViewMode));

        // Assert: timeScale is unchanged
        const storedTimeScale = JSON.parse(localStorage.getItem(TIME_SCALE_KEY)!);
        expect(storedTimeScale).toBe(timeScale);
      },
    );
  });

  describe("switching viewMode does not modify timeCursor value", () => {
    it.each(viewModeTimeScaleCombinations)(
      "timeCursor is preserved when viewMode changes (timeScale=$timeScale, viewMode=$viewMode)",
      ({ viewMode, timeScale }) => {
        const timeCursor = new Date(2024, 5, 15).toISOString();

        // Arrange: set up localStorage with timeScale, viewMode, and timeCursor
        localStorage.setItem(TIME_SCALE_KEY, JSON.stringify(timeScale));
        localStorage.setItem(VIEW_MODE_KEY, JSON.stringify("calendar"));
        localStorage.setItem(TIME_CURSOR_KEY, JSON.stringify(timeCursor));

        // Act: switch viewMode
        localStorage.setItem(VIEW_MODE_KEY, JSON.stringify(viewMode));

        // Assert: timeScale and timeCursor are both unchanged
        const storedTimeScale = JSON.parse(localStorage.getItem(TIME_SCALE_KEY)!);
        const storedCursor = JSON.parse(localStorage.getItem(TIME_CURSOR_KEY)!);

        expect(storedTimeScale).toBe(timeScale);
        expect(storedCursor).toBe(timeCursor);
      },
    );
  });

  describe("viewMode key write only affects the viewMode key", () => {
    it.each(viewModeTimeScaleCombinations)(
      "writing viewMode=$viewMode does not affect other keys (timeScale=$timeScale)",
      ({ viewMode, timeScale }) => {
        // Arrange: set up all keys
        localStorage.setItem(TIME_SCALE_KEY, JSON.stringify(timeScale));
        localStorage.setItem(VIEW_MODE_KEY, JSON.stringify("calendar"));

        // Snapshot all key values before the switch (excluding VIEW_MODE_KEY)
        const valuesBefore = new Map<string, string | null>();
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)!;
          if (key !== VIEW_MODE_KEY) {
            valuesBefore.set(key, localStorage.getItem(key));
          }
        }

        // Act: switch viewMode
        localStorage.setItem(VIEW_MODE_KEY, JSON.stringify(viewMode));

        // Assert: no other keys were affected
        for (const [key, valueBefore] of valuesBefore) {
          expect(localStorage.getItem(key)).toBe(valueBefore);
        }
      },
    );
  });
});
