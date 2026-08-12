import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CalendarOccurrence, TimelineItem } from "../../types";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import { resolveTimelineFilterPlan } from "./timelineFilterPlan";
import {
  fetchMergedTimelineEvents,
  mergeTimelineFilterSources,
  paddedTimelineFetchWindow,
  TIMELINE_CALENDAR_FETCH_PADDING_DAYS,
} from "./timelineMergedFetch";

const {
  mockFetchSharedTimelineEvents,
  mockFetchSharedCalendarItems,
  mockFetchSharedUserEvents,
} = vi.hoisted(() => ({
  mockFetchSharedTimelineEvents: vi.fn(),
  mockFetchSharedCalendarItems: vi.fn(),
  mockFetchSharedUserEvents: vi.fn(),
}));

vi.mock("./sharedCalendarFetch", () => ({
  fetchSharedTimelineEvents: (...args: unknown[]) => mockFetchSharedTimelineEvents(...args),
  fetchSharedCalendarItems: (...args: unknown[]) => mockFetchSharedCalendarItems(...args),
  fetchSharedUserEvents: (...args: unknown[]) => mockFetchSharedUserEvents(...args),
}));

function makeAnalysis(overrides: Partial<TimelineItem> = {}): TimelineItem {
  return {
    id: "a-1",
    taskId: "evt-1",
    version: 1,
    batchId: "b1",
    title: "分析",
    body: "",
    startTime: "2025-01-10T00:00:00Z",
    endTime: null,
    location: null,
    latitude: null,
    longitude: null,
    participants: [],
    sourceMessageId: null,
    sourcePlatform: null,
    sourceChannelName: null,
    sourceMessageTime: null,
    analysisTimeRange: null,
    batchSourceChannelNames: [],
    taskName: "事件任務",
    createdAt: "2025-01-10T00:00:00Z",
    updatedAt: "2025-01-10T00:00:00Z",
    ...overrides,
  };
}

function makeOccurrence(overrides: Partial<CalendarOccurrence> = {}): CalendarOccurrence {
  return {
    id: "cal-1:20250115T090000Z",
    seriesId: "cal-1",
    taskName: "週會",
    title: "週會",
    startTime: "2025-01-15T09:00:00Z",
    endTime: "2025-01-15T10:00:00Z",
    isAllDay: false,
    location: null,
    description: null,
    rrule: "FREQ=WEEKLY",
    source: "recurring",
    ...overrides,
  };
}

function makeItemOccurrence(
  overrides: Partial<CalendarOccurrence> = {},
): CalendarOccurrence {
  return {
    id: "item:i1:remind",
    taskId: "",
    taskName: "",
    title: "Milk",
    startTime: "2025-01-20T00:00:00",
    endTime: "2025-01-20T23:59:59",
    isAllDay: true,
    timezone: "floating",
    location: null,
    description: null,
    rrule: "",
    source: "item_remind",
    worksetId: SYSTEM_WORKSET_ID,
    itemId: "i1",
    itemDateKind: "remind",
    dismissed: false,
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

describe("mergeTimelineFilterSources", () => {
  const catalog = [
    { id: "evt-1", analysisMode: "intel_event", worksetId: "ws-A" },
    { id: "web-1", analysisMode: "agent", outputAnalysisEvents: true, worksetId: "ws-A" },
  ];

  it("merges analysis + user + calendar in the all-sources view", () => {
    const plan = resolveTimelineFilterPlan(null, catalog);
    const user: TimelineItem = {
      ...makeAnalysis({ id: "ue-1", taskId: null, title: "手動", source: "user" }),
      worksetId: SYSTEM_WORKSET_ID,
    };
    const merged = mergeTimelineFilterSources({
      selectedSources: null,
      filterPlan: plan,
      analysisEvents: [makeAnalysis()],
      calendarOccurrences: [makeOccurrence()],
      userEvents: [user],
    });
    expect(merged.map((e) => e.id).sort()).toEqual(["a-1", "cal-1:20250115T090000Z", "ue-1"]);
  });

  it("keeps agent analysis events when that task is selected (no items)", () => {
    const plan = resolveTimelineFilterPlan({ taskIds: ["web-1"], worksetIds: [] }, catalog);
    expect(plan).toMatchObject({
      fetchAnalysis: true,
      fetchItems: false,
      analysisTaskIds: ["web-1"],
    });
    // Fetch layer already scopes by analysisTaskIds; merge trusts that payload.
    const webFinding = makeAnalysis({
      id: "web-hit",
      taskId: "web-1",
      title: "Pricing spike",
    });
    const merged = mergeTimelineFilterSources({
      selectedSources: { taskIds: ["web-1"], worksetIds: [] },
      filterPlan: plan,
      analysisEvents: [webFinding],
      calendarOccurrences: [makeOccurrence(), makeItemOccurrence()],
      userEvents: [],
    });
    expect(merged.map((e) => e.id)).toEqual(["web-hit"]);
    expect(merged.every((e) => e.source !== "item_remind")).toBe(true);
  });

  it("merges source=item_remind rows from the unified calendar fetch", () => {
    const plan = resolveTimelineFilterPlan(null, catalog);
    const merged = mergeTimelineFilterSources({
      selectedSources: null,
      filterPlan: plan,
      analysisEvents: [],
      calendarOccurrences: [makeOccurrence(), makeItemOccurrence()],
      userEvents: [],
    });
    const item = merged.find((e) => e.source === "item_remind");
    expect(item?.id).toBe("item:i1:remind");
    expect(item?.itemId).toBe("i1");
    expect(item?.itemDateKind).toBe("remind");
    expect(item?.dismissed).toBe(false);
    expect(item?.startTime).toBe("2025-01-20T00:00:00");
  });

  it("returns empty for an explicit empty selection", () => {
    const plan = resolveTimelineFilterPlan({ taskIds: [], worksetIds: [] }, catalog);
    expect(
      mergeTimelineFilterSources({
        selectedSources: { taskIds: [], worksetIds: [] },
        filterPlan: plan,
        analysisEvents: [makeAnalysis()],
        calendarOccurrences: [makeOccurrence()],
        userEvents: [],
      }),
    ).toEqual([]);
  });

  it("filters recurring rows by selected workset", () => {
    const selection = { taskIds: [] as string[], worksetIds: ["ws-A"] };
    const plan = resolveTimelineFilterPlan(selection, catalog);
    const merged = mergeTimelineFilterSources({
      selectedSources: selection,
      filterPlan: plan,
      analysisEvents: [],
      calendarOccurrences: [
        makeOccurrence({ id: "cal-1:a", seriesId: "cal-1", worksetId: "ws-A" }),
        makeOccurrence({ id: "cal-2:b", seriesId: "cal-2", worksetId: "ws-B" }),
      ],
      userEvents: [],
    });
    expect(merged).toHaveLength(1);
    expect(merged[0].seriesId).toBe("cal-1");
    expect(merged[0].source).toBe("recurring");
  });
});

describe("fetchMergedTimelineEvents", () => {
  beforeEach(() => {
    mockFetchSharedTimelineEvents.mockReset().mockResolvedValue([]);
    mockFetchSharedCalendarItems.mockReset().mockResolvedValue([]);
    mockFetchSharedUserEvents.mockReset().mockResolvedValue([]);
  });

  it("skips sources the filter plan does not need", async () => {
    const catalog = [{ id: "evt-1", analysisMode: "intel_event", worksetId: "ws-A" }];
    const selection = { taskIds: ["evt-1"], worksetIds: [] as string[] };
    const plan = resolveTimelineFilterPlan(selection, catalog);
    mockFetchSharedTimelineEvents.mockResolvedValue([makeAnalysis()]);
    mockFetchSharedUserEvents.mockResolvedValue([
      {
        id: "ue-match",
        title: "掛到事件任務",
        body: "",
        startTime: "2025-01-12T08:00:00Z",
        endTime: null,
        location: null,
        origin: "manual",
        source: "user",
        taskId: "evt-1",
        worksetId: SYSTEM_WORKSET_ID,
        createdAt: "2025-01-12T08:00:00Z",
        updatedAt: "2025-01-12T08:00:00Z",
      },
    ]);

    const events = await fetchMergedTimelineEvents({
      selectedSources: selection,
      filterPlan: plan,
      startIso: "2025-01-01T00:00:00.000Z",
      endIso: "2025-02-01T00:00:00.000Z",
    });

    expect(mockFetchSharedTimelineEvents).toHaveBeenCalled();
    expect(mockFetchSharedUserEvents).toHaveBeenCalled();
    // No recurring + no workset → fetchItems false → calendar skipped
    expect(mockFetchSharedCalendarItems).not.toHaveBeenCalled();
    expect(events.map((e) => e.id).sort()).toEqual(["a-1", "ue-match"]);
  });

  it("fetches unified calendar items (incl. source=item_remind) for workset selection", async () => {
    const plan = resolveTimelineFilterPlan(
      { taskIds: [], worksetIds: [SYSTEM_WORKSET_ID] },
      [],
    );
    expect(plan.fetchItems).toBe(true);
    expect(plan.fetchCalendar).toBe(true);

    mockFetchSharedCalendarItems.mockResolvedValue([
      makeItemOccurrence({ dismissed: true }),
    ]);

    const events = await fetchMergedTimelineEvents({
      selectedSources: { taskIds: [], worksetIds: [SYSTEM_WORKSET_ID] },
      filterPlan: plan,
      startIso: "2025-01-01T00:00:00.000Z",
      endIso: "2025-02-01T00:00:00.000Z",
    });

    expect(mockFetchSharedCalendarItems).toHaveBeenCalledWith(
      "2025-01-01T00:00:00.000Z",
      "2025-02-01T00:00:00.000Z",
      { includeItems: true },
    );
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe("item_remind");
    expect(events[0].dismissed).toBe(true);
  });

  it("propagates calendar fetch failures", async () => {
    const plan = resolveTimelineFilterPlan(null, []);
    mockFetchSharedCalendarItems.mockRejectedValue(new Error("calendar boom"));
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

    mockFetchSharedCalendarItems.mockResolvedValue([
      makeOccurrence({
        id: "rec-new:20260801T010000Z",
        seriesId: "rec-new",
        worksetId: SYSTEM_WORKSET_ID,
        title: "每日",
        startTime: "2026-08-01T01:00:00Z",
      }),
      makeOccurrence({
        id: "rec-new:20260802T010000Z",
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

    expect(mockFetchSharedCalendarItems).toHaveBeenCalledWith(
      "2026-08-01T00:00:00.000Z",
      "2026-08-31T23:59:59.000Z",
      { includeItems: true },
    );
    expect(events.filter((e) => e.source === "recurring")).toHaveLength(2);
  });
});
