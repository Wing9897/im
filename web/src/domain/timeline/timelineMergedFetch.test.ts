import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CalendarWindowItem } from "../../api/calendarWindow";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import { resolveTimelineFilterPlan } from "./timelineFilterPlan";
import { filterTimelineWindowEvents, windowItemToBoardEvent } from "./timedEventMerge";
import {
  fetchMergedTimelineEvents,
  paddedTimelineFetchWindow,
  TIMELINE_CALENDAR_FETCH_PADDING_DAYS,
} from "./timelineMergedFetch";

const { mockFetchCalendarWindow } = vi.hoisted(() => ({
  mockFetchCalendarWindow: vi.fn(),
}));

vi.mock("../../api/calendarWindow", () => ({
  fetchCalendarWindow: (...args: unknown[]) => mockFetchCalendarWindow(...args),
}));

function makeWindowItem(
  overrides: Partial<CalendarWindowItem> & Pick<CalendarWindowItem, "id" | "source" | "title">,
): CalendarWindowItem {
  return {
    startTime: "2025-01-10T00:00:00Z",
    endTime: null,
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

describe("paddedTimelineFetchWindow", () => {
  it("pads both ends by the default day count", () => {
    const start = new Date("2025-01-01T00:00:00.000Z");
    const end = new Date("2025-02-01T00:00:00.000Z");
    const window = paddedTimelineFetchWindow(start, end);
    expect(new Date(window.startIso).getTime()).toBeLessThan(start.getTime());
    expect(new Date(window.endIso).getTime()).toBeGreaterThan(end.getTime());
    const padMs = TIMELINE_CALENDAR_FETCH_PADDING_DAYS * 24 * 60 * 60 * 1000;
    expect(start.getTime() - new Date(window.startIso).getTime()).toBe(padMs);
    expect(new Date(window.endIso).getTime() - end.getTime()).toBe(padMs);
  });
});

describe("filterTimelineWindowEvents", () => {
  const catalog = [
    { id: "evt-1", analysisMode: "intel_event", worksetId: "ws-A" },
    { id: "web-1", analysisMode: "agent", outputAnalysisEvents: true, worksetId: "ws-A" },
  ];

  it("keeps analysis + user + recurring in the all-sources view", () => {
    const plan = resolveTimelineFilterPlan(null, catalog);
    const user = windowItemToBoardEvent(
      makeWindowItem({
        id: "ue-1",
        source: "user",
        title: "手動",
        worksetId: SYSTEM_WORKSET_ID,
      }),
    );
    const filtered = filterTimelineWindowEvents({
      selectedSources: null,
      filterPlan: plan,
      events: [
        windowItemToBoardEvent(
          makeWindowItem({
            id: "a-1",
            source: "analysis",
            title: "分析",
            taskId: "evt-1",
            taskName: "事件任務",
          }),
        ),
        windowItemToBoardEvent(
          makeWindowItem({
            id: "cal-1:20250115T090000Z",
            source: "recurring",
            title: "週會",
            seriesId: "cal-1",
            taskName: "週會",
            startTime: "2025-01-15T09:00:00Z",
            endTime: "2025-01-15T10:00:00Z",
          }),
        ),
        user,
      ],
    });
    expect(filtered.map((e) => e.id).sort()).toEqual(["a-1", "cal-1:20250115T090000Z", "ue-1"]);
  });

  it("keeps agent analysis events when that task is selected (no items)", () => {
    const plan = resolveTimelineFilterPlan({ taskIds: ["web-1"], worksetIds: [] }, catalog);
    expect(plan).toMatchObject({
      fetchAnalysis: true,
      fetchItems: false,
      analysisTaskIds: ["web-1"],
    });
    const filtered = filterTimelineWindowEvents({
      selectedSources: { taskIds: ["web-1"], worksetIds: [] },
      filterPlan: plan,
      events: [
        windowItemToBoardEvent(
          makeWindowItem({
            id: "web-hit",
            source: "analysis",
            title: "Pricing spike",
            taskId: "web-1",
          }),
        ),
        windowItemToBoardEvent(
          makeWindowItem({
            id: "cal-1:20250115T090000Z",
            source: "recurring",
            title: "週會",
            seriesId: "cal-1",
          }),
        ),
        windowItemToBoardEvent(
          makeWindowItem({
            id: "item:i1:remind",
            source: "item_remind",
            title: "Milk",
            startTime: "2025-01-20T00:00:00",
            endTime: "2025-01-20T23:59:59",
            isAllDay: true,
            timezone: "floating",
            itemId: "i1",
            itemDateKind: "remind",
          }),
        ),
      ],
    });
    expect(filtered.map((e) => e.id)).toEqual(["web-hit"]);
    expect(filtered.every((e) => e.source !== "item_remind")).toBe(true);
  });

  it("keeps source=item_remind rows from the unified calendar window", () => {
    const plan = resolveTimelineFilterPlan(null, catalog);
    const filtered = filterTimelineWindowEvents({
      selectedSources: null,
      filterPlan: plan,
      events: [
        windowItemToBoardEvent(
          makeWindowItem({
            id: "cal-1:20250115T090000Z",
            source: "recurring",
            title: "週會",
            seriesId: "cal-1",
          }),
        ),
        windowItemToBoardEvent(
          makeWindowItem({
            id: "item:i1:remind",
            source: "item_remind",
            title: "Milk",
            startTime: "2025-01-20T00:00:00",
            endTime: "2025-01-20T23:59:59",
            isAllDay: true,
            timezone: "floating",
            itemId: "i1",
            itemDateKind: "remind",
          }),
        ),
      ],
    });
    const item = filtered.find((e) => e.source === "item_remind");
    expect(item?.id).toBe("item:i1:remind");
    expect(item?.itemId).toBe("i1");
    expect(item?.itemDateKind).toBe("remind");
    expect(item?.dismissed).toBe(false);
    expect(item?.startTime).toBe("2025-01-20T00:00:00");
  });

  it("returns empty for an explicit empty selection", () => {
    const plan = resolveTimelineFilterPlan({ taskIds: [], worksetIds: [] }, catalog);
    expect(
      filterTimelineWindowEvents({
        selectedSources: { taskIds: [], worksetIds: [] },
        filterPlan: plan,
        events: [
          windowItemToBoardEvent(
            makeWindowItem({ id: "a-1", source: "analysis", title: "分析", taskId: "evt-1" }),
          ),
          windowItemToBoardEvent(
            makeWindowItem({
              id: "cal-1:20250115T090000Z",
              source: "recurring",
              title: "週會",
              seriesId: "cal-1",
            }),
          ),
        ],
      }),
    ).toEqual([]);
  });

  it("filters recurring rows by selected workset", () => {
    const selection = { taskIds: [] as string[], worksetIds: ["ws-A"] };
    const plan = resolveTimelineFilterPlan(selection, catalog);
    const filtered = filterTimelineWindowEvents({
      selectedSources: selection,
      filterPlan: plan,
      events: [
        windowItemToBoardEvent(
          makeWindowItem({
            id: "cal-1:a",
            source: "recurring",
            title: "週會",
            seriesId: "cal-1",
            worksetId: "ws-A",
          }),
        ),
        windowItemToBoardEvent(
          makeWindowItem({
            id: "cal-2:b",
            source: "recurring",
            title: "週會",
            seriesId: "cal-2",
            worksetId: "ws-B",
          }),
        ),
      ],
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].seriesId).toBe("cal-1");
    expect(filtered[0].source).toBe("recurring");
  });
});

describe("fetchMergedTimelineEvents", () => {
  beforeEach(() => {
    mockFetchCalendarWindow.mockReset().mockResolvedValue([]);
  });

  it("scopes calendar/window include flags from the filter plan", async () => {
    const catalog = [{ id: "evt-1", analysisMode: "intel_event", worksetId: "ws-A" }];
    const selection = { taskIds: ["evt-1"], worksetIds: [] as string[] };
    const plan = resolveTimelineFilterPlan(selection, catalog);
    mockFetchCalendarWindow.mockResolvedValue([
      makeWindowItem({
        id: "a-1",
        source: "analysis",
        title: "分析",
        taskId: "evt-1",
        taskName: "事件任務",
      }),
      makeWindowItem({
        id: "ue-match",
        source: "user",
        title: "掛到事件任務",
        startTime: "2025-01-12T08:00:00Z",
        origin: "manual",
        taskId: "evt-1",
      }),
    ]);

    const events = await fetchMergedTimelineEvents({
      selectedSources: selection,
      filterPlan: plan,
      startIso: "2025-01-01T00:00:00.000Z",
      endIso: "2025-02-01T00:00:00.000Z",
    });

    expect(mockFetchCalendarWindow).toHaveBeenCalledWith({
      startTime: "2025-01-01T00:00:00.000Z",
      endTime: "2025-02-01T00:00:00.000Z",
      includeAnalysis: true,
      includeUser: true,
      includeRecurring: false,
      includeItems: false,
    });
    expect(events.map((e) => e.id).sort()).toEqual(["a-1", "ue-match"]);
  });

  it("fetches unified calendar occurrences (incl. source=item_remind) for workset selection", async () => {
    const plan = resolveTimelineFilterPlan(
      { taskIds: [], worksetIds: [SYSTEM_WORKSET_ID] },
      [],
    );
    expect(plan.fetchItems).toBe(true);
    expect(plan.fetchCalendar).toBe(true);

    mockFetchCalendarWindow.mockResolvedValue([
      makeWindowItem({
        id: "item:i1:remind",
        source: "item_remind",
        title: "Milk",
        startTime: "2025-01-20T00:00:00",
        endTime: "2025-01-20T23:59:59",
        isAllDay: true,
        timezone: "floating",
        itemId: "i1",
        itemDateKind: "remind",
        dismissed: true,
      }),
    ]);

    const events = await fetchMergedTimelineEvents({
      selectedSources: { taskIds: [], worksetIds: [SYSTEM_WORKSET_ID] },
      filterPlan: plan,
      startIso: "2025-01-01T00:00:00.000Z",
      endIso: "2025-02-01T00:00:00.000Z",
    });

    expect(mockFetchCalendarWindow).toHaveBeenCalledWith({
      startTime: "2025-01-01T00:00:00.000Z",
      endTime: "2025-02-01T00:00:00.000Z",
      includeAnalysis: false,
      includeUser: true,
      includeRecurring: true,
      includeItems: true,
    });
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe("item_remind");
    expect(events[0].dismissed).toBe(true);
  });

  it("propagates calendar fetch failures", async () => {
    const plan = resolveTimelineFilterPlan(null, []);
    mockFetchCalendarWindow.mockRejectedValue(new Error("calendar boom"));
    await expect(
      fetchMergedTimelineEvents({
        selectedSources: null,
        filterPlan: plan,
        startIso: "2025-01-01T00:00:00.000Z",
        endIso: "2025-02-01T00:00:00.000Z",
      }),
    ).rejects.toThrow("calendar boom");
  });

  it("fetches standalone recurring occurrences for a selected workset", async () => {
    const plan = resolveTimelineFilterPlan(
      { taskIds: [], worksetIds: [SYSTEM_WORKSET_ID] },
      [],
    );
    expect(plan.fetchCalendar).toBe(true);
    expect(plan.seriesIds).toBeNull();

    mockFetchCalendarWindow.mockResolvedValue([
      makeWindowItem({
        id: "rec-new:20260801T010000Z",
        source: "recurring",
        seriesId: "rec-new",
        worksetId: SYSTEM_WORKSET_ID,
        title: "每日",
        startTime: "2026-08-01T01:00:00Z",
      }),
      makeWindowItem({
        id: "rec-new:20260802T010000Z",
        source: "recurring",
        seriesId: "rec-new",
        worksetId: SYSTEM_WORKSET_ID,
        title: "每日",
        startTime: "2026-08-02T01:00:00Z",
      }),
    ]);

    const events = await fetchMergedTimelineEvents({
      selectedSources: { taskIds: [], worksetIds: [SYSTEM_WORKSET_ID] },
      filterPlan: plan,
      startIso: "2026-08-01T00:00:00.000Z",
      endIso: "2026-08-31T23:59:59.000Z",
    });

    expect(mockFetchCalendarWindow).toHaveBeenCalledWith({
      startTime: "2026-08-01T00:00:00.000Z",
      endTime: "2026-08-31T23:59:59.000Z",
      includeAnalysis: false,
      includeUser: true,
      includeRecurring: true,
      includeItems: true,
    });
    expect(events.filter((e) => e.source === "recurring")).toHaveLength(2);
  });
});
