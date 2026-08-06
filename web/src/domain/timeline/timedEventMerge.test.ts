import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AnalysisEvent, CalendarOccurrence } from "../../types";
import {
  calendarOccurrenceToBoardEvent,
  fetchBoardEventsList,
  mergeWithCalendarOccurrences,
  userEventToBoardEvent,
  userEventToTimelineItem,
} from "./timedEventMerge";
import { getGeneralWorksetLabel } from "./userEvents";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";

vi.mock("../../api/results", () => ({
  fetchEvents: vi.fn(),
  fetchCalendarOccurrences: vi.fn(),
}));

vi.mock("../../api/userEvents", () => ({
  listUserEvents: vi.fn(),
}));

/** Local AnalysisEvent fixture for merge tests (not timelineTestHelpers.makeEvent). */
function makeEvent(overrides: Partial<AnalysisEvent> = {}): AnalysisEvent {
  return {
    id: "evt-1",
    taskId: "task-a",
    version: 1,
    batchId: "b1",
    title: "分析事件",
    body: "",
    startTime: "2026-07-22T09:00:00.000Z",
    endTime: "2026-07-22T10:00:00.000Z",
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
    createdAt: "2026-07-22T09:00:00.000Z",
    updatedAt: "2026-07-22T09:00:00.000Z",
    ...overrides,
  };
}

function makeOccurrence(overrides: Partial<CalendarOccurrence> = {}): CalendarOccurrence {
  return {
    id: "cal-task:20260722T090000Z",
    taskId: "cal-task",
    taskName: "週期任務",
    title: "週會",
    startTime: "2026-07-22T09:00:00.000Z",
    endTime: "2026-07-22T09:30:00.000Z",
    isAllDay: false,
    timezone: "Asia/Taipei",
    location: null,
    description: "RRULE 展開",
    rrule: "FREQ=WEEKLY",
    ...overrides,
  };
}

describe("calendarOccurrenceToBoardEvent", () => {
  it("marks source as calendar and keeps taskId for filtering", () => {
    const event = calendarOccurrenceToBoardEvent(makeOccurrence());
    expect(event.source).toBe("recurring");
    expect(event.taskId).toBe("cal-task");
    expect(event.body).toBe("RRULE 展開");
    expect(event.isAllDay).toBe(false);
    expect(event.timezone).toBe("Asia/Taipei");
  });

  it("keeps parent itemId on recurring linked calendars", () => {
    const event = calendarOccurrenceToBoardEvent(
      makeOccurrence({ itemId: "item-9" }),
    );
    expect(event.source).toBe("recurring");
    expect(event.itemId).toBe("item-9");
  });
});

describe("mergeWithCalendarOccurrences", () => {
  it("appends calendar occurrences after timed events", () => {
    const merged = mergeWithCalendarOccurrences([makeEvent()], [makeOccurrence()]);
    expect(merged).toHaveLength(2);
    expect(merged[1].id).toBe("cal-task:20260722T090000Z");
    expect(merged[1].source).toBe("recurring");
  });

  it("skips occurrence with the same id", () => {
    const merged = mergeWithCalendarOccurrences(
      [makeEvent({ id: "cal-task:20260722T090000Z" })],
      [makeOccurrence()],
    );
    expect(merged).toHaveLength(1);
  });

  it("skips occurrence with the same taskId and startTime", () => {
    const merged = mergeWithCalendarOccurrences(
      [makeEvent({ id: "other-id", taskId: "cal-task", startTime: "2026-07-22T09:00:00.000Z" })],
      [makeOccurrence()],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe("other-id");
  });

  it("deduplicates equivalent occurrence timestamps with different ISO precision", () => {
    const merged = mergeWithCalendarOccurrences(
      [makeEvent({ id: "other-id", taskId: "cal-task", startTime: "2026-07-22T09:00:00Z" })],
      [makeOccurrence({ startTime: "2026-07-22T09:00:00.000Z" })],
    );
    expect(merged).toHaveLength(1);
  });

  it("keeps a single bar when user_event provenance matches an RRULE occurrence", () => {
    const userTimed = userEventToBoardEvent({
      id: "ue-provenance",
      title: "已落地的循环实例",
      body: "",
      startTime: "2026-07-22T09:00:00.000Z",
      endTime: "2026-07-22T09:30:00.000Z",
      location: null,
      origin: "manual",
      source: "user",
      taskId: "cal-task",
      worksetId: "ws-1",
      createdAt: "2026-07-21T00:00:00Z",
      updatedAt: "2026-07-21T00:00:00Z",
      isAllDay: true,
      timezone: "Asia/Taipei",
    });
    const merged = mergeWithCalendarOccurrences([userTimed], [makeOccurrence()]);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe("ue-provenance");
    expect(merged[0].source).toBe("user");
  });
});

describe("userEventToBoardEvent", () => {
  it("keeps provenance empty and ownership on worksetId for untagged events", () => {
    const event = userEventToBoardEvent({
      id: "user-event-1",
      title: "使用者建立的會議",
      body: "討論甘特圖",
      startTime: "2026-07-22T09:00:00Z",
      endTime: "2026-07-22T10:00:00Z",
      location: null,
      origin: "assistant",
      source: "user",
      taskId: "",
      worksetId: SYSTEM_WORKSET_ID,
      createdAt: "2026-07-21T00:00:00Z",
      updatedAt: "2026-07-21T00:00:00Z",
      isAllDay: true,
      timezone: "Asia/Taipei",
    });

    expect(event.taskId).toBeNull();
    expect(event.worksetId).toBe(SYSTEM_WORKSET_ID);
    expect(event.taskName).toBe(getGeneralWorksetLabel());
    expect(event.origin).toBe("assistant");
    expect(event.startTime).toBe("2026-07-22T09:00:00Z");
    expect(event.endTime).toBe("2026-07-22T10:00:00Z");
    expect(event.isAllDay).toBe(true);
    expect(event.timezone).toBe("Asia/Taipei");
  });

  it("keeps task-tagged user events on their provenance task id and resolves taskName", () => {
    const event = userEventToBoardEvent(
      {
        id: "user-event-2",
        title: "掛到日曆任務",
        body: "",
        startTime: "2026-07-22T11:00:00Z",
        endTime: null,
        location: null,
        origin: "manual",
        source: "user",
        taskId: "ct-1",
        worksetId: "ws-1",
        createdAt: "2026-07-21T00:00:00Z",
        updatedAt: "2026-07-21T00:00:00Z",
      },
      new Map([["ct-1", "日曆任務"]]),
    );

    expect(event.taskId).toBe("ct-1");
    expect(event.worksetId).toBe("ws-1");
    expect(event.taskName).toBe("日曆任務");
  });

  it("keeps a project-owned user event on its project task", () => {
    const event = userEventToBoardEvent(
      {
        id: "user-event-project",
        title: "Kickoff",
        body: "",
        startTime: "2026-07-22T11:00:00Z",
        endTime: null,
        location: null,
        origin: "project",
        source: "user",
        taskId: "proj-1",
        worksetId: SYSTEM_WORKSET_ID,
        createdAt: "2026-07-21T00:00:00Z",
        updatedAt: "2026-07-21T00:00:00Z",
      },
      new Map([["proj-1", "專案 Alpha"]]),
      "一般",
    );

    expect(event.taskId).toBe("proj-1");
    expect(event.worksetId).toBe(SYSTEM_WORKSET_ID);
    expect(event.taskName).toBe("專案 Alpha");
    expect(event.origin).toBe("project");
  });
});

describe("userEventToTimelineItem", () => {
  it("returns null when startTime is missing", () => {
    const item = userEventToTimelineItem({
      id: "ue-no-time",
      title: "無時間",
      body: "",
      startTime: "",
      endTime: null,
      location: null,
      origin: "manual",
      source: "user",
      taskId: "",
      createdAt: "2026-07-21T00:00:00Z",
      updatedAt: "2026-07-21T00:00:00Z",
    });
    expect(item).toBeNull();
  });

  it("reuses board projection fields including worksetId and origin", () => {
    const item = userEventToTimelineItem(
      {
        id: "ue-1",
        title: "用戶事件",
        body: "內容",
        startTime: "2026-07-22T08:00:00Z",
        endTime: null,
        location: null,
        origin: "manual",
        source: "user",
        taskId: "",
        worksetId: SYSTEM_WORKSET_ID,
        createdAt: "2026-07-21T00:00:00Z",
        updatedAt: "2026-07-21T00:00:00Z",
      },
      undefined,
      "一般",
    );
    expect(item).not.toBeNull();
    expect(item!.taskId).toBeNull();
    expect(item!.worksetId).toBe(SYSTEM_WORKSET_ID);
    expect(item!.startTime).toBe("2026-07-22T08:00:00Z");
    expect(item!.origin).toBe("manual");
    expect(item!.taskName).toBe("一般");
    expect(item!.source).toBe("user");
  });
});

describe("fetchBoardEventsList", () => {
  beforeEach(async () => {
    const { fetchEvents, fetchCalendarOccurrences } = await import("../../api/results");
    const { listUserEvents } = await import("../../api/userEvents");
    vi.mocked(fetchEvents).mockReset();
    vi.mocked(fetchCalendarOccurrences).mockReset();
    vi.mocked(listUserEvents).mockReset();
    vi.mocked(fetchEvents).mockResolvedValue({
      items: [
        makeEvent({
          id: "a1",
          createdAt: "2026-07-22T12:00:00.000Z",
          startTime: null,
        }),
      ],
      total: 1,
    } as never);
    vi.mocked(listUserEvents).mockResolvedValue([
      {
        id: "ue-1",
        title: "手動",
        body: "",
        startTime: "2026-07-22T13:00:00Z",
        endTime: null,
        location: null,
        origin: "manual",
        source: "user",
        taskId: "",
        worksetId: SYSTEM_WORKSET_ID,
        createdAt: "2026-07-22T13:00:00Z",
        updatedAt: "2026-07-22T13:00:00Z",
      },
    ]);
    vi.mocked(fetchCalendarOccurrences).mockResolvedValue([makeOccurrence()]);
  });

  it("merges analysis + user events, sorts by time desc, skips calendar by default", async () => {
    const { fetchCalendarOccurrences } = await import("../../api/results");
    const items = await fetchBoardEventsList({ includeCalendar: false, limit: 15 });
    expect(fetchCalendarOccurrences).not.toHaveBeenCalled();
    expect(items.map((e) => e.id)).toEqual(["ue-1", "a1"]);
    expect(items[0].source).toBe("user");
  });

  it("requests analyzed_at sort from fetchEvents", async () => {
    const { fetchEvents } = await import("../../api/results");
    await fetchBoardEventsList({ limit: 15 });
    expect(fetchEvents).toHaveBeenCalledWith(
      expect.objectContaining({ sort: "analyzed_at", limit: 15 }),
    );
  });
});
