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
    taskId: "cal-1",
    taskName: "週會",
    title: "週會",
    startTime: "2025-01-15T09:00:00Z",
    endTime: "2025-01-15T10:00:00Z",
    isAllDay: false,
    location: null,
    description: null,
    rrule: "FREQ=WEEKLY",
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
    { id: "evt-1", analysisMode: "event", worksetId: "ws-A" },
    { id: "cal-1", analysisMode: "recurring", worksetId: "ws-A" },
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

  it("filters calendar rows to selected recurring tasks", () => {
    const plan = resolveTimelineFilterPlan({ taskIds: ["cal-1"], worksetIds: [] }, catalog);
    const merged = mergeTimelineFilterSources({
      selectedSources: { taskIds: ["cal-1"], worksetIds: [] },
      filterPlan: plan,
      analysisEvents: [],
      calendarOccurrences: [
        makeOccurrence({ id: "cal-1:a", taskId: "cal-1" }),
        makeOccurrence({ id: "cal-2:b", taskId: "cal-2" }),
      ],
      userEvents: [],
    });
    expect(merged).toHaveLength(1);
    expect(merged[0].taskId).toBe("cal-1");
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
    const catalog = [{ id: "evt-1", analysisMode: "event", worksetId: "ws-A" }];
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
    expect(mockFetchSharedCalendarItems).not.toHaveBeenCalled();
    expect(events.map((e) => e.id).sort()).toEqual(["a-1", "ue-match"]);
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
});
