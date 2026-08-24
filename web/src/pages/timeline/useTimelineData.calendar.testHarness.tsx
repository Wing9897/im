/**
 * Shared setup for useTimelineData calendar hook tests.
 *
 * Split files keep distinct cases:
 * - `useTimelineData.calendar.refresh.test.tsx` — refresh / SSE / errors
 * - `useTimelineData.calendar.merge.test.tsx` — window merge / filters
 *
 * `vi.mock` for calendar + catalog still lives in each file (Vitest hoist).
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";

import type { CalendarWindowItem } from "../../api/calendarWindow";
import {
  MONITOR_MODE_KEY,
  MonitorModeProvider,
} from "../../context/MonitorModeContext";
import type { SourceFilterSelection } from "../../domain/tasks/sourceFilterSelection";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import { useTimelineData } from "./useTimelineData";

export type TimelineDataHookResult = ReturnType<typeof useTimelineData>;

export const TIMELINE_CALENDAR_TEST_RANGE = {
  start: new Date("2025-01-01T00:00:00Z"),
  end: new Date("2025-02-01T00:00:00Z"),
} as const;

export function makeCalendarWindowItem(
  overrides: Partial<CalendarWindowItem> & Pick<CalendarWindowItem, "id" | "source" | "title">,
): CalendarWindowItem {
  return {
    startTime: "2025-01-15T09:00:00Z",
    endTime: "2025-01-15T10:00:00Z",
    location: null,
    isAllDay: false,
    timezone: null,
    emoji: null,
    taskId: null,
    seriesId: null,
    worksetId: SYSTEM_WORKSET_ID,
    itemId: null,
    origin: null,
    itemDateKind: null,
    notifyPref: "inherit",
    dismissed: false,
    important: false,
    taskName: null,
    isLastOccurrence: false,
    remindBeforeDays: null,
    body: "",
    ...overrides,
  };
}

export function TimelineDataHookHarness({
  selectedSources,
  refOut,
  rangeStart = TIMELINE_CALENDAR_TEST_RANGE.start,
  rangeEnd = TIMELINE_CALENDAR_TEST_RANGE.end,
}: {
  selectedSources: SourceFilterSelection;
  refOut: { current: TimelineDataHookResult | null };
  rangeStart?: Date;
  rangeEnd?: Date;
}) {
  const result = useTimelineData({
    selectedSources,
    viewMode: "calendar",
    rangeStart,
    rangeEnd,
  });
  refOut.current = result;
  return null;
}

export async function renderTimelineDataHook(
  container: HTMLDivElement,
  refOut: { current: TimelineDataHookResult | null },
  selectedSources: SourceFilterSelection = null,
  range?: { start?: Date; end?: Date },
): Promise<Root> {
  let root!: Root;
  await act(async () => {
    root = createRoot(container);
    root.render(
      createElement(
        MemoryRouter,
        null,
        createElement(
          MonitorModeProvider,
          null,
          createElement(TimelineDataHookHarness, {
            selectedSources,
            refOut,
            rangeStart: range?.start,
            rangeEnd: range?.end,
          }),
        ),
      ),
    );
  });
  return root;
}

export function setupTimelineDataCalendarDom(): HTMLDivElement {
  window.localStorage.setItem(MONITOR_MODE_KEY, "pages");
  const container = document.createElement("div");
  document.body.appendChild(container);
  return container;
}

export function teardownTimelineDataCalendarDom(
  root: Root | null,
  container: HTMLDivElement,
): void {
  if (root) {
    act(() => {
      root.unmount();
    });
  }
  container.remove();
}
