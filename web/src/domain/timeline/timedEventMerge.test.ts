import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CalendarWindowItem } from "../../api/calendarWindow";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import { resolveTimelineFilterPlan } from "./timelineFilterPlan";
import {
  fetchBoardEventsList,
  filterTimelineWindowEvents,
  userEventToBoardEvent,
  userEventToTimelineItem,
  windowItemToBoardEvent,
} from "./timedEventMerge";
import { getGeneralWorksetLabel } from "./userEvents";

vi.mock("../../api/calendarWindow", () => ({
  fetchCalendarWindow: vi.fn(),
}));

function makeWindowItem(
  overrides: Partial<CalendarWindowItem> & Pick<CalendarWindowItem, "id" | "source" | "title">,
): CalendarWindowItem {
  return {
    startTime: "2026-07-22T09:00:00.000Z",
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

function makeRecurringWindowItem(
  overrides: Partial<CalendarWindowItem> = {},
): CalendarWindowItem {
  return makeWindowItem({
    id: "cal-task:20260722T090000Z",
    source: "recurring",
    title: "週會",
    seriesId: "cal-task",
    taskName: "週期任務",
    startTime: "2026-07-22T09:00:00.000Z",
    endTime: "2026-07-22T09:30:00.000Z",
    timezone: "Asia/Taipei",
    body: "RRULE 展開",
    ...overrides,
  });
}

describe("windowItemToBoardEvent", () => {
  it("marks source as recurring and keeps seriesId for filtering", () => {
    const event = windowItemToBoardEvent(makeRecurringWindowItem({ worksetId: "ws-cal" }));
    expect(event.source).toBe("recurring");
    expect(event.seriesId).toBe("cal-task");
    expect(event.worksetId).toBe("ws-cal");
    expect(event.body).toBe("RRULE 展開");
    expect(event.isAllDay).toBe(false);
    expect(event.timezone).toBe("Asia/Taipei");
  });

  it("keeps parent itemId on recurring linked calendars", () => {
    const event = windowItemToBoardEvent(makeRecurringWindowItem({ itemId: "item-9" }));
    expect(event.source).toBe("recurring");
    expect(event.itemId).toBe("item-9");
  });

  it("preserves the all-day flag on adapted window rows", () => {
    const event = windowItemToBoardEvent(makeRecurringWindowItem({ isAllDay: true }));
    expect(event.isAllDay).toBe(true);
    expect(event.source).toBe("recurring");
  });

  it("projects item_remind rows with a remind title and no seriesId", () => {
    const event = windowItemToBoardEvent(
      makeWindowItem({
        id: "item:i1:remind",
        source: "item_remind",
        title: "Milk",
        itemId: "i1",
        itemDateKind: "remind",
        isAllDay: true,
      }),
    );
    expect(event.source).toBe("item_remind");
    expect(event.seriesId).toBeNull();
    expect(event.itemId).toBe("i1");
    expect(event.itemDateKind).toBe("remind");
    expect(event.worksetId).toBe(SYSTEM_WORKSET_ID);
    expect(event.title).toContain("Milk");
  });
});

describe("filterTimelineWindowEvents", () => {
  const catalog = [
    { id: "evt-1", analysisMode: "intel_event", worksetId: "ws-A" },
    { id: "web-1", analysisMode: "agent", outputAnalysisEvents: true, worksetId: "ws-A" },
  ];

  it("keeps analysis + user + recurring in the all-sources view", () => {
    const plan = resolveTimelineFilterPlan(null, catalog);
    const events = [
      windowItemToBoardEvent(
        makeWindowItem({ id: "a-1", source: "analysis", title: "分析", taskId: "evt-1" }),
      ),
      windowItemToBoardEvent(
        makeWindowItem({
          id: "ue-provenance",
          source: "user",
          title: "分析任务溯源事件",
          origin: "manual",
          taskId: "cal-task",
          worksetId: "ws-1",
        }),
      ),
      windowItemToBoardEvent(makeRecurringWindowItem()),
    ];
    const filtered = filterTimelineWindowEvents({
      selectedSources: null,
      filterPlan: plan,
      events,
    });
    // seriesId (recurring) and taskId (analysis provenance) are separate namespaces.
    expect(filtered.map((item) => item.id).sort()).toEqual(
      ["a-1", "cal-task:20260722T090000Z", "ue-provenance"].sort(),
    );
    expect(filtered.find((item) => item.id === "cal-task:20260722T090000Z")?.source).toBe(
      "recurring",
    );
  });

  it("keeps agent analysis events when that task is selected (no items)", () => {
    const plan = resolveTimelineFilterPlan({ taskIds: ["web-1"], worksetIds: [] }, catalog);
    expect(plan).toMatchObject({
      fetchAnalysis: true,
      fetchItems: false,
      analysisTaskIds: ["web-1"],
    });
    const events = [
      windowItemToBoardEvent(
        makeWindowItem({
          id: "web-hit",
          source: "analysis",
          title: "Pricing spike",
          taskId: "web-1",
        }),
      ),
      windowItemToBoardEvent(makeRecurringWindowItem()),
      windowItemToBoardEvent(
        makeWindowItem({
          id: "item:i1:remind",
          source: "item_remind",
          title: "Milk",
          itemId: "i1",
          itemDateKind: "remind",
        }),
      ),
    ];
    const filtered = filterTimelineWindowEvents({
      selectedSources: { taskIds: ["web-1"], worksetIds: [] },
      filterPlan: plan,
      events,
    });
    expect(filtered.map((e) => e.id)).toEqual(["web-hit"]);
    expect(filtered.every((e) => e.source !== "item_remind")).toBe(true);
  });

  it("keeps source=item_remind rows when items are in the plan", () => {
    const plan = resolveTimelineFilterPlan(null, catalog);
    const events = [
      windowItemToBoardEvent(makeRecurringWindowItem()),
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
    ];
    const filtered = filterTimelineWindowEvents({
      selectedSources: null,
      filterPlan: plan,
      events,
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
          windowItemToBoardEvent(makeRecurringWindowItem()),
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
          makeRecurringWindowItem({ id: "cal-1:a", seriesId: "cal-1", worksetId: "ws-A" }),
        ),
        windowItemToBoardEvent(
          makeRecurringWindowItem({ id: "cal-2:b", seriesId: "cal-2", worksetId: "ws-B" }),
        ),
      ],
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].seriesId).toBe("cal-1");
    expect(filtered[0].source).toBe("recurring");
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
        origin: "agent",
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
    expect(event.origin).toBe("agent");
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
    const { fetchCalendarWindow } = await import("../../api/calendarWindow");
    vi.mocked(fetchCalendarWindow).mockReset().mockResolvedValue([
      makeWindowItem({
        id: "a1",
        source: "analysis",
        title: "分析",
        startTime: "2026-07-22T12:00:00.000Z",
      }),
      makeWindowItem({
        id: "ue-1",
        source: "user",
        title: "手動",
        startTime: "2026-07-22T13:00:00Z",
        origin: "manual",
      }),
      makeWindowItem({
        id: "cal-1",
        source: "recurring",
        title: "週會",
        seriesId: "cal-task",
        startTime: "2026-07-22T09:00:00.000Z",
      }),
    ]);
  });

  it("merges window occurrences and sorts by time desc", async () => {
    const items = await fetchBoardEventsList({ limit: 15 });
    expect(items.map((e) => e.id)).toEqual(["ue-1", "a1", "cal-1"]);
    expect(items[0].source).toBe("user");
    expect(items[2].source).toBe("recurring");
  });

  it("requests a merged calendar/window (analysis + user + RRULE + items)", async () => {
    const { fetchCalendarWindow } = await import("../../api/calendarWindow");
    await fetchBoardEventsList({ limit: 15 });
    expect(fetchCalendarWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        includeAnalysis: true,
        includeUser: true,
        includeRecurring: true,
        includeItems: true,
      }),
    );
  });
});
