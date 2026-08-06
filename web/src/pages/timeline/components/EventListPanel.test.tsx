import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import i18n from "../../../i18n";
import { setAppLocale } from "../../../i18n/locale";

import { EventListPanel, previewEventBody } from "./EventListPanel";
import { makeTimelineItem } from "../../../test/analysisEventFixtures";
import {
  makeAnalysisTask,
  resetTaskCatalogState,
  taskCatalogState,
} from "../../../test/context-mocks";
import { SYSTEM_WORKSET_ID } from "../../../types/worksets";
import {
  TimelinePageProvider,
  type TimelinePageContextValue,
} from "../TimelinePageContext";

vi.mock("../../../context/TaskCatalogContext", async () =>
  (await import("../../../test/context-mocks")).taskCatalogModuleMock(),
);

function makeEvent(id: string, title: string, body = "") {
  return makeTimelineItem({
    id,
    title,
    body,
    startTime: "2026-07-14T00:00:00.000Z",
    endTime: "2026-07-15T00:00:00.000Z",
  });
}

function makeContext(
  overrides: Partial<TimelinePageContextValue> = {},
): TimelinePageContextValue {
  return {
    selectedEvent: null,
    onSelectEvent: vi.fn(),
    editStartTime: "",
    editEndTime: "",
    setEditStartTime: vi.fn(),
    setEditEndTime: vi.fn(),
    onSaveTimeOverride: vi.fn(),
    onResetTimeOverride: vi.fn(),
    onSetEventStatus: vi.fn(),
    eventStatuses: {},
    showDismissed: true,
    showOngoing: true,
    showEnding: true,
    taskSpans: [],
    selectedGanttTaskId: null,
    onSelectGanttTask: vi.fn(),
    spansInitialLoading: false,
    spansIsRefreshing: false,
    spansError: null,
    onRetrySpans: vi.fn(),
    selectedGanttSpan: null,
    onCloseGanttPanel: vi.fn(),
    ganttColumns: [],
    timelineEvents: [],
    timelineEventsInitialLoading: false,
    timelineEventsIsRefreshing: false,
    timelineEventsError: null,
    onRetryTimelineEvents: vi.fn(),
    ...overrides,
  };
}

function renderPanel(props: {
  rangeEvents: ReturnType<typeof makeEvent>[];
  focusedDay?: Date | null;
  onSelectEvent?: () => void;
  context?: Partial<TimelinePageContextValue>;
}) {
  const container = document.createElement("div");
  const root = createRoot(container);
  act(() => {
    root.render(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(TimelinePageProvider, {
          value: makeContext(props.context),
          children: createElement(EventListPanel, {
            rangeEvents: props.rangeEvents,
            focusedDay: props.focusedDay ?? null,
            onSelectEvent: props.onSelectEvent ?? (() => {}),
          }),
        }),
      ),
    );
  });
  return { container, root };
}

describe("previewEventBody", () => {
  it("collapses multiline whitespace for list preview", () => {
    expect(previewEventBody("line1\n\nline2   line3")).toBe("line1 line2 line3");
  });
});

describe("EventListPanel", () => {
  beforeEach(async () => {
    setAppLocale("zh-Hant");
    await i18n.changeLanguage("zh-Hant");
    resetTaskCatalogState();
    taskCatalogState.worksets = [
      {
        id: SYSTEM_WORKSET_ID,
        name: "一般",
        createdAt: null,
        updatedAt: null,
      },
    ];
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 20, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows only the date in the list header (no 本日 prefix)", () => {
    const dayEvent = makeEvent("day", "Day Event");
    const focusedDay = new Date(2026, 6, 14);
    const { container } = renderPanel({
      rangeEvents: [dayEvent],
      focusedDay,
    });

    expect(container.textContent).toContain("Day Event");
    const dayLabel = container.querySelector(
      '[data-testid="timeline-event-list-day-label"]',
    );
    const filter = container.querySelector(
      '[data-testid="timeline-event-phase-filter"]',
    );
    expect(dayLabel).not.toBeNull();
    expect(dayLabel?.textContent).not.toContain("本日");
    expect(dayLabel?.textContent).toMatch(/14/);
    expect(dayLabel?.className).toContain("ml-auto");
    expect(filter).not.toBeNull();
    expect(dayLabel?.parentElement).toBe(filter?.parentElement);
    expect(container.textContent).not.toContain("全範圍");
  });

  it("uses real-now buckets and 跨日进行中 / 结束于当日 when viewing Aug 8 from Aug 6", () => {
    // Product bug fixture: today Aug 6, selected Aug 8.
    vi.setSystemTime(new Date(2026, 7, 6, 12, 0, 0));
    const trip = makeTimelineItem({
      id: "trip",
      title: "三日出差",
      startTime: new Date(2026, 7, 7, 9, 0, 0).toISOString(),
      endTime: new Date(2026, 7, 9, 18, 0, 0).toISOString(),
    });
    const overnight = makeTimelineItem({
      id: "overnight",
      title: "Overnight Watch",
      startTime: new Date(2026, 7, 7, 8, 0, 0).toISOString(),
      endTime: new Date(2026, 7, 8, 8, 0, 0).toISOString(),
    });
    const alreadyCovering = makeTimelineItem({
      id: "covering",
      title: "Conference Week",
      startTime: new Date(2026, 7, 5, 9, 0, 0).toISOString(),
      endTime: new Date(2026, 7, 10, 18, 0, 0).toISOString(),
    });
    const later = makeTimelineItem({
      id: "later",
      title: "Afternoon Meet",
      startTime: new Date(2026, 7, 8, 14, 0, 0).toISOString(),
      endTime: new Date(2026, 7, 8, 15, 0, 0).toISOString(),
    });
    const startsTonight = makeTimelineItem({
      id: "starts",
      title: "Starts Tonight",
      startTime: new Date(2026, 7, 8, 20, 0, 0).toISOString(),
      endTime: new Date(2026, 7, 9, 8, 0, 0).toISOString(),
    });

    const { container } = renderPanel({
      rangeEvents: [trip, overnight, alreadyCovering, later, startsTonight],
      focusedDay: new Date(2026, 7, 8),
    });

    const filter = container.querySelector(
      '[data-testid="timeline-event-phase-filter"]',
    );
    expect(filter?.textContent).toContain("進行中");
    expect(filter?.textContent).toContain("未開始");
    expect(filter?.textContent).not.toContain("跨日進行中");
    expect(filter?.textContent).not.toContain("結束於本日");
    expect(filter?.textContent).not.toContain("結束於當日");
    expect(
      container.querySelector('[data-testid="timeline-event-phase-filter-ending"]'),
    ).toBeNull();

    const ongoingGroup = container.querySelector(
      '[data-testid="timeline-event-group-ongoing"]',
    );
    const upcomingGroup = container.querySelector(
      '[data-testid="timeline-event-group-upcoming"]',
    );
    // Only already-started covering is 进行中; future trip/overnight stay 未开始.
    expect(ongoingGroup?.textContent).toContain("Conference Week");
    expect(ongoingGroup?.textContent).not.toContain("三日出差");
    expect(upcomingGroup?.textContent).toContain("三日出差");
    expect(upcomingGroup?.textContent).toContain("Overnight Watch");
    expect(upcomingGroup?.textContent).toContain("Afternoon Meet");
    expect(upcomingGroup?.textContent).toContain("Starts Tonight");

    expect(
      container.querySelector(
        '[data-testid="timeline-event-day-phase-ongoing-multi-day"]',
      )?.textContent,
    ).toBe("跨日進行中");
    expect(
      container.querySelector(
        '[data-testid="timeline-event-day-phase-ending-focused"]',
      )?.textContent,
    ).toBe("結束於當日");
    expect(
      container.querySelector(
        '[data-testid="timeline-event-day-phase-ending-today"]',
      ),
    ).toBeNull();
    expect(
      upcomingGroup?.querySelector('[data-testid="timeline-event-cross-day"]'),
    ).toBeNull();
    // Future multi-day cover still shows card span tag (not the old month +N chip).
    expect(
      upcomingGroup?.querySelector(
        '[data-testid="timeline-event-day-phase-ongoing-multi-day"]',
      )?.textContent,
    ).toBe("跨日進行中");
  });

  it("uses 跨日进行中 + 结束于本日 when focused day is real today", () => {
    vi.setSystemTime(new Date(2026, 7, 8, 12, 0, 0));
    const overnight = makeTimelineItem({
      id: "overnight",
      title: "Overnight Watch",
      startTime: new Date(2026, 7, 7, 8, 0, 0).toISOString(),
      endTime: new Date(2026, 7, 8, 8, 0, 0).toISOString(),
    });
    const covering = makeTimelineItem({
      id: "covering",
      title: "Conference Week",
      startTime: new Date(2026, 7, 6, 9, 0, 0).toISOString(),
      endTime: new Date(2026, 7, 10, 18, 0, 0).toISOString(),
    });
    const later = makeTimelineItem({
      id: "later",
      title: "Afternoon Meet",
      startTime: new Date(2026, 7, 8, 14, 0, 0).toISOString(),
      endTime: new Date(2026, 7, 8, 15, 0, 0).toISOString(),
    });

    const { container } = renderPanel({
      rangeEvents: [overnight, covering, later],
      focusedDay: new Date(2026, 7, 8),
    });

    const ongoingGroup = container.querySelector(
      '[data-testid="timeline-event-group-ongoing"]',
    );
    const upcomingGroup = container.querySelector(
      '[data-testid="timeline-event-group-upcoming"]',
    );
    expect(ongoingGroup?.textContent).toContain("Overnight Watch");
    expect(ongoingGroup?.textContent).toContain("Conference Week");
    expect(upcomingGroup?.textContent).toContain("Afternoon Meet");

    expect(
      ongoingGroup?.querySelector(
        '[data-testid="timeline-event-day-phase-ending-today"]',
      )?.textContent,
    ).toBe("結束於本日");
    expect(
      ongoingGroup?.querySelector(
        '[data-testid="timeline-event-day-phase-ongoing-multi-day"]',
      )?.textContent,
    ).toBe("跨日進行中");
  });

  it("renders multiline body as a single truncated preview line", () => {
    const event = makeEvent(
      "body-1",
      "Polymarket title",
      "第一行摘要\n\n第二行細節\n第三行",
    );
    const { container } = renderPanel({
      rangeEvents: [event],
      focusedDay: new Date(2026, 6, 14),
    });

    expect(container.textContent).toContain("第一行摘要 第二行細節 第三行");
    expect(container.querySelector(".line-clamp-2")).toBeNull();
    const preview = container.querySelector(".truncate.text-text-secondary") as HTMLElement | null;
    expect(preview?.getAttribute("title")).toContain("第一行摘要");
  });

  it("keeps event cards in a dedicated scroll container with shrink-0", () => {
    const events = Array.from({ length: 20 }, (_, index) =>
      makeEvent(`e-${index}`, `Event ${index}`),
    );
    const { container } = renderPanel({
      rangeEvents: events,
      focusedDay: new Date(2026, 6, 14),
    });

    const scroll = container.querySelector(
      '[data-testid="timeline-event-list-scroll"]',
    ) as HTMLElement | null;
    expect(scroll).not.toBeNull();
    expect(scroll?.className).toContain("overflow-y-auto");
    expect(scroll?.className).toContain("im-timeline-event-list");
    expect(container.textContent).toContain("Event 19");
    expect(container.querySelectorAll(".im-timeline-event-list-item").length).toBe(20);
    expect(
      container.querySelector(".im-timeline-event-list-item")?.className,
    ).toContain("shrink-0");
    expect(
      container.querySelector(".im-timeline-event-list-item")?.className,
    ).toContain("im-card-hover");
  });

  it("groups into 進行中 / 未開始 and folds clock-ended into 进行中", () => {
    vi.setSystemTime(new Date(2026, 6, 15, 12, 0, 0));
    const upcoming = makeTimelineItem({
      id: "up",
      title: "Upcoming Meet",
      startTime: new Date(2026, 6, 15, 14, 0, 0).toISOString(),
      endTime: new Date(2026, 6, 15, 15, 0, 0).toISOString(),
    });
    const ongoing = makeTimelineItem({
      id: "on",
      title: "Ongoing Meet",
      startTime: new Date(2026, 6, 15, 10, 0, 0).toISOString(),
      endTime: new Date(2026, 6, 15, 14, 0, 0).toISOString(),
    });
    const ended = makeTimelineItem({
      id: "en",
      title: "Ended Meet",
      startTime: new Date(2026, 6, 15, 8, 0, 0).toISOString(),
      endTime: new Date(2026, 6, 15, 9, 0, 0).toISOString(),
    });

    const { container } = renderPanel({
      rangeEvents: [upcoming, ongoing, ended],
      focusedDay: new Date(2026, 6, 15),
    });

    expect(container.textContent).toContain("未開始");
    expect(container.textContent).toContain("進行中");
    expect(container.textContent).not.toContain("目前已完結");
    expect(
      container.querySelector('[data-testid="timeline-event-group-upcoming"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="timeline-event-group-ongoing"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="timeline-event-group-ending"]'),
    ).toBeNull();

    const upcomingGroup = container.querySelector(
      '[data-testid="timeline-event-group-upcoming"]',
    );
    const ongoingGroup = container.querySelector(
      '[data-testid="timeline-event-group-ongoing"]',
    );
    expect(upcomingGroup?.textContent).toContain("Upcoming Meet");
    expect(ongoingGroup?.textContent).toContain("Ongoing Meet");
    expect(ongoingGroup?.textContent).toContain("Ended Meet");
  });

  it("quick-filters the list to one phase bucket", () => {
    vi.setSystemTime(new Date(2026, 6, 15, 12, 0, 0));
    const upcoming = makeTimelineItem({
      id: "up",
      title: "Upcoming Meet",
      startTime: new Date(2026, 6, 15, 14, 0, 0).toISOString(),
      endTime: new Date(2026, 6, 15, 15, 0, 0).toISOString(),
    });
    const ongoing = makeTimelineItem({
      id: "on",
      title: "Ongoing Meet",
      startTime: new Date(2026, 6, 15, 10, 0, 0).toISOString(),
      endTime: new Date(2026, 6, 15, 14, 0, 0).toISOString(),
    });
    const { container } = renderPanel({
      rangeEvents: [upcoming, ongoing],
      focusedDay: new Date(2026, 6, 15),
    });

    const upcomingChip = container.querySelector(
      '[data-testid="timeline-event-phase-filter-upcoming"]',
    ) as HTMLButtonElement | null;
    expect(upcomingChip).not.toBeNull();
    expect(upcomingChip?.textContent).toBe("未開始");
    act(() => {
      upcomingChip?.click();
    });
    expect(
      container.querySelector('[data-testid="timeline-event-group-upcoming"]')
        ?.textContent,
    ).toContain("Upcoming Meet");
    expect(
      container.querySelector('[data-testid="timeline-event-group-ongoing"]'),
    ).toBeNull();
  });

  it("hides empty time-phase groups", () => {
    vi.setSystemTime(new Date(2026, 6, 15, 12, 0, 0));
    const upcoming = makeTimelineItem({
      id: "up-only",
      title: "Only Upcoming",
      startTime: new Date(2026, 6, 15, 14, 0, 0).toISOString(),
      endTime: new Date(2026, 6, 15, 15, 0, 0).toISOString(),
    });

    const { container } = renderPanel({
      rangeEvents: [upcoming],
      focusedDay: new Date(2026, 6, 15),
    });

    expect(
      container.querySelector('[data-testid="timeline-event-group-upcoming"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="timeline-event-group-ongoing"]'),
    ).toBeNull();
    expect(container.textContent).toContain("未開始");
  });

  it("shows workset + provenance and remind badge; never 購入 / short 结束", () => {
    resetTaskCatalogState([
      makeAnalysisTask({ id: "task-ops", name: "Ops Task", worksetId: "ws-ops" }),
    ]);
    taskCatalogState.worksets = [
      { id: SYSTEM_WORKSET_ID, name: "一般", createdAt: null, updatedAt: null },
      { id: "ws-ops", name: "營運", createdAt: null, updatedAt: null },
    ];

    const purchased = makeTimelineItem({
      id: "item:p",
      title: "購入 · milk",
      source: "item",
      itemDateKind: "purchased",
      worksetId: SYSTEM_WORKSET_ID,
      startTime: new Date(2026, 6, 14, 10, 0, 0).toISOString(),
      endTime: new Date(2026, 6, 14, 11, 0, 0).toISOString(),
    });
    const remind = makeTimelineItem({
      id: "item:r",
      title: "提醒 · milk",
      source: "item",
      itemDateKind: "remind",
      worksetId: SYSTEM_WORKSET_ID,
      startTime: new Date(2026, 6, 14, 12, 0, 0).toISOString(),
      endTime: new Date(2026, 6, 14, 13, 0, 0).toISOString(),
    });
    const expires = makeTimelineItem({
      id: "item:e",
      title: "結束 · milk",
      source: "item",
      itemDateKind: "expires",
      worksetId: SYSTEM_WORKSET_ID,
      startTime: new Date(2026, 6, 14, 14, 0, 0).toISOString(),
      endTime: new Date(2026, 6, 14, 15, 0, 0).toISOString(),
    });
    const assistant = makeTimelineItem({
      id: "user:a",
      title: "助手會議",
      source: "user",
      origin: "assistant",
      worksetId: SYSTEM_WORKSET_ID,
      taskName: "一般",
      startTime: new Date(2026, 6, 14, 16, 0, 0).toISOString(),
      endTime: new Date(2026, 6, 14, 17, 0, 0).toISOString(),
    });
    const assistantRemind = makeTimelineItem({
      id: "user:a-remind",
      title: "助手提醒會議",
      source: "user",
      origin: "assistant",
      remindBeforeDays: 2,
      worksetId: SYSTEM_WORKSET_ID,
      taskName: "一般",
      startTime: new Date(2026, 6, 14, 16, 30, 0).toISOString(),
      endTime: new Date(2026, 6, 14, 17, 30, 0).toISOString(),
    });
    const userRemind = makeTimelineItem({
      id: "user:manual-remind",
      title: "用戶提醒會議",
      source: "user",
      origin: "manual",
      remindBeforeDays: 1,
      worksetId: SYSTEM_WORKSET_ID,
      taskName: "一般",
      startTime: new Date(2026, 6, 14, 15, 30, 0).toISOString(),
      endTime: new Date(2026, 6, 14, 16, 0, 0).toISOString(),
    });
    const analysis = makeTimelineItem({
      id: "an:1",
      title: "分析事件",
      source: "analysis",
      taskId: "task-ops",
      taskName: "Ops Task",
      startTime: new Date(2026, 6, 14, 18, 0, 0).toISOString(),
      endTime: new Date(2026, 6, 14, 19, 0, 0).toISOString(),
    });
    const { container } = renderPanel({
      rangeEvents: [
        purchased,
        remind,
        expires,
        userRemind,
        assistant,
        assistantRemind,
        analysis,
      ],
      focusedDay: new Date(2026, 6, 14),
    });

    const badges = Array.from(
      container.querySelectorAll('[data-testid="timeline-remind-badge"]'),
    ).map((node) => node.textContent);
    expect(badges).toEqual(["提醒", "提醒", "提醒"]);
    expect(badges).not.toContain("結束");
    expect(badges).not.toContain("完結");
    expect(badges).not.toContain("購入");

    const worksets = Array.from(
      container.querySelectorAll('[data-testid="timeline-event-list-workset"]'),
    ).map((node) => node.textContent);
    expect(worksets.some((text) => text?.includes("工作集：一般"))).toBe(true);
    expect(worksets.some((text) => text?.includes("工作集：營運"))).toBe(true);

    const provenances = Array.from(
      container.querySelectorAll('[data-testid="timeline-event-list-provenance"]'),
    ).map((node) => node.textContent);
    expect(provenances).toContain("物品");
    expect(provenances).toContain("助手");
    expect(provenances.some((text) => text?.includes("任務：Ops Task"))).toBe(true);

    expect(
      container.querySelector(
        '[data-testid="timeline-event-day-phase-ending-focused"]',
      )?.textContent,
    ).toBe("結束於當日");

    // Badge / ending tag already convey 提醒 / 结束 — titles stay bare.
    expect(container.textContent).not.toContain("提醒 · milk");
    expect(container.textContent).not.toContain("結束 · milk");
    expect(container.textContent).not.toContain("購入 · milk");
    expect(container.textContent).toContain("milk");
  });

  it("shows location placeholder and status on sidebar cards", () => {
    const event = makeTimelineItem({
      id: "loc-1",
      title: "With Place",
      location: "台北",
      startTime: new Date(2026, 6, 14, 10, 0, 0).toISOString(),
      endTime: new Date(2026, 6, 14, 11, 0, 0).toISOString(),
      important: true,
    });
    const { container } = renderPanel({
      rangeEvents: [event],
      focusedDay: new Date(2026, 6, 14),
    });

    expect(
      container.querySelector('[data-testid="timeline-event-list-location"]')?.textContent,
    ).toContain("地點：台北");
    expect(
      container.querySelector('[data-testid="timeline-important-marker"]')?.textContent,
    ).toBe("❗");
    expect(container.textContent).toContain("❗");
    expect(
      container.querySelector('[data-testid="timeline-event-list-status"]'),
    ).not.toBeNull();

    const emptyLoc = makeTimelineItem({
      id: "loc-2",
      title: "No Place",
      location: null,
      startTime: new Date(2026, 6, 14, 12, 0, 0).toISOString(),
      endTime: new Date(2026, 6, 14, 13, 0, 0).toISOString(),
    });
    const { container: emptyContainer } = renderPanel({
      rangeEvents: [emptyLoc],
      focusedDay: new Date(2026, 6, 14),
    });
    expect(
      emptyContainer.querySelector('[data-testid="timeline-event-list-location"]')
        ?.textContent,
    ).toContain("地點：N/A");
  });

  it("important item rows use ❗ leading marker instead of kind emoji", () => {
    const event = makeTimelineItem({
      id: "item-imp",
      title: "結束 · milk",
      source: "item",
      itemDateKind: "expires",
      important: true,
      startTime: new Date(2026, 6, 14, 10, 0, 0).toISOString(),
      endTime: new Date(2026, 6, 14, 11, 0, 0).toISOString(),
    });
    const { container } = renderPanel({
      rangeEvents: [event],
      focusedDay: new Date(2026, 6, 14),
    });

    expect(
      container.querySelector('[data-testid="timeline-important-marker"]')?.textContent,
    ).toBe("❗");
    expect(container.querySelector('[data-testid="timeline-item-kind-marker"]')).toBeNull();
    // Ending tag present → bare title (no 结束 · prefix).
    expect(container.textContent).toContain("milk");
    expect(container.textContent).not.toMatch(/結束\s*·\s*milk/);
    expect(container.textContent).not.toContain("⚠️");
  });

  it("keeps click selection on grouped event cards", () => {
    vi.setSystemTime(new Date(2026, 6, 15, 12, 0, 0));
    const upcoming = makeTimelineItem({
      id: "click-me",
      title: "Click Me",
      startTime: new Date(2026, 6, 15, 14, 0, 0).toISOString(),
      endTime: new Date(2026, 6, 15, 15, 0, 0).toISOString(),
    });
    const picked: string[] = [];
    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => {
      root.render(
        createElement(
          I18nextProvider,
          { i18n },
          createElement(TimelinePageProvider, {
            value: makeContext(),
            children: createElement(EventListPanel, {
              rangeEvents: [upcoming],
              focusedDay: new Date(2026, 6, 15),
              onSelectEvent: (event) => {
                picked.push(event?.id ?? "");
              },
            }),
          }),
        ),
      );
    });

    const clickButton = container.querySelector(
      ".im-timeline-event-list-item button",
    );
    expect(clickButton).not.toBeNull();
    act(() => {
      clickButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(picked).toEqual(["click-me"]);
  });
});
