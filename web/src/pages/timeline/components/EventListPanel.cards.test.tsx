import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { ensureZhHantLocale, wrapWithI18n } from "../../../test/i18nHarness";
import { EventListPanel } from "./EventListPanel";
import { makeTimelineItem } from "../../../test/analysisEventFixtures";
import {
  makeAnalysisTask,
  resetTaskCatalogState,
  taskCatalogState,
} from "../../../test/context-mocks";
import { SYSTEM_WORKSET_ID } from "../../../types/worksets";
import { TimelinePageProvider } from "../TimelinePageContext";
import { makeContext, makeEvent, renderPanel } from "./eventListPanelTestUtils";

vi.mock("../../../context/TaskCatalogContext", async () =>
  (await import("../../../test/context-mocks")).taskCatalogModuleMock(),
);

describe("EventListPanel", () => {
  beforeEach(async () => {
    await ensureZhHantLocale();
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

  it("shows workset + provenance and remind badge; never 購入 / short 结束", () => {
    resetTaskCatalogState([
      makeAnalysisTask({ id: "task-ops", name: "Ops Task", worksetId: "ws-ops" }),
    ]);
    taskCatalogState.worksets = [
      { id: SYSTEM_WORKSET_ID, name: "一般", createdAt: null, updatedAt: null },
      { id: "ws-ops", name: "營運", createdAt: null, updatedAt: null },
    ];

    const remind = makeTimelineItem({
      id: "item:r",
      title: "提醒 · milk",
      source: "item_remind",
      itemDateKind: "remind",
      worksetId: SYSTEM_WORKSET_ID,
      startTime: new Date(2026, 6, 14, 12, 0, 0).toISOString(),
      endTime: new Date(2026, 6, 14, 13, 0, 0).toISOString(),
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
        remind,
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

    const titleIcons = container.querySelectorAll('[data-testid="card-title-icon"]');
    expect(titleIcons.length).toBe(3);
    expect(titleIcons[0]?.getAttribute("width")).toBe("20");

    expect(container.querySelectorAll('[data-testid="intel-event-avatar-stack"]').length).toBe(1);
    const intelMark = container.querySelector(
      '[data-testid="intel-event-mark"]',
    ) as HTMLElement | null;
    const taskOverlay = container.querySelector(
      '[data-testid="intel-event-task-badge"] [data-testid="task-logo-mark"]',
    ) as HTMLElement | null;
    expect(intelMark?.style.width).toBe("28px");
    expect(taskOverlay?.style.width).toBe("14px");
    expect(intelMark?.querySelector("svg")?.classList.contains("lucide-radar")).toBe(true);
    expect(taskOverlay?.querySelector("svg")?.classList.contains("lucide-list-checks")).toBe(true);
    const taskProvenance = Array.from(
      container.querySelectorAll('[data-testid="timeline-event-list-provenance"]'),
    ).find((node) => node.textContent?.includes("任務：Ops Task"));
    expect(taskProvenance?.querySelector('[data-testid="intel-event-avatar-stack"]')).toBeNull();
    expect(taskProvenance?.querySelector('[data-testid="intel-event-mark"]')).toBeNull();
    expect(taskProvenance?.querySelector("svg")?.getAttribute("width")).toBe("14");
    expect(taskProvenance?.querySelector("svg")?.classList.contains("lucide-list-checks")).toBe(
      true,
    );

    // Single-day fixtures: ending day-phase tag is not shown (multi-day covered elsewhere).
    expect(
      container.querySelector(
        '[data-testid="timeline-event-day-phase-ending-focused"]',
      ),
    ).toBeNull();

    // Remind badge already conveys 提醒 — title stays bare.
    expect(container.textContent).not.toContain("提醒 · milk");
    expect(container.textContent).toContain("milk");
  });

  it("shows a user task emoji on the small overlay, not the large intel mark or 任務 row", () => {
    const analysis = makeTimelineItem({
      id: "an:emoji",
      title: "分析事件",
      source: "analysis",
      taskId: "task-ops",
      taskName: "Ops Task",
      emoji: "🎯",
      startTime: new Date(2026, 6, 14, 18, 0, 0).toISOString(),
      endTime: new Date(2026, 6, 14, 19, 0, 0).toISOString(),
    });
    const { container } = renderPanel({
      rangeEvents: [analysis],
      focusedDay: new Date(2026, 6, 14),
    });
    const stack = container.querySelector('[data-testid="intel-event-avatar-stack"]');
    const intel = container.querySelector('[data-testid="intel-event-mark"]');
    const badge = container.querySelector('[data-testid="intel-event-task-badge"]');
    expect(stack).not.toBeNull();
    expect(intel?.querySelector("svg")?.classList.contains("lucide-radar")).toBe(true);
    expect(intel?.textContent).not.toContain("🎯");
    expect(badge?.textContent).toContain("🎯");
    expect(container.querySelector('[data-testid="task-avatar-stack"]')).toBeNull();
    const provenance = container.querySelector(
      '[data-testid="timeline-event-list-provenance"]',
    );
    expect(provenance?.textContent).toContain("任務：Ops Task");
    expect(provenance?.textContent).not.toContain("🎯");
    expect(provenance?.querySelector('[data-testid="intel-event-avatar-stack"]')).toBeNull();
    expect(provenance?.querySelector("svg")?.getAttribute("width")).toBe("14");
    expect(provenance?.querySelector("svg")?.classList.contains("lucide-list-checks")).toBe(
      true,
    );
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
    // Empty / legacy "N/A" locations render without a literal N/A placeholder.
    const emptyLocText = emptyContainer.querySelector(
      '[data-testid="timeline-event-list-location"]',
    )?.textContent;
    expect(emptyLocText).toContain("地點：");
    expect(emptyLocText).not.toContain("N/A");
  });

  it("user schedule cards always show location and notes, using N/A when empty", () => {
    const event = makeTimelineItem({
      id: "user-empty",
      title: "用戶空欄",
      source: "user",
      origin: "manual",
      location: null,
      body: "",
      startTime: new Date(2026, 6, 14, 10, 0, 0).toISOString(),
      endTime: new Date(2026, 6, 14, 11, 0, 0).toISOString(),
    });
    const { container } = renderPanel({
      rangeEvents: [event],
      focusedDay: new Date(2026, 6, 14),
    });

    expect(
      container.querySelector('[data-testid="timeline-event-list-location"]')?.textContent,
    ).toContain("地點：N/A");
    expect(
      container.querySelector('[data-testid="timeline-event-list-notes"]')?.textContent,
    ).toContain("說明：N/A");
    expect(
      container.querySelector('[data-testid="timeline-event-list-meta"]')?.className,
    ).toContain("flex-col");
  });

  it("important item rows use ❗ leading marker instead of kind emoji", () => {
    const event = makeTimelineItem({
      id: "item-imp",
      title: "milk",
      source: "item_remind",
      itemDateKind: "remind",
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
    expect(container.textContent).toContain("milk");
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
        wrapWithI18n(
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

  it("shows the shared schedule emoji instead of CalendarDays for user events", () => {
    const event = makeTimelineItem({
      id: "ue-bday",
      title: "生日",
      source: "user",
      origin: "manual",
      emoji: "🎂",
      startTime: new Date(2026, 6, 14, 10, 0, 0).toISOString(),
      endTime: new Date(2026, 6, 14, 11, 0, 0).toISOString(),
    });
    const { container } = renderPanel({
      rangeEvents: [event],
      focusedDay: new Date(2026, 6, 14),
    });
    expect(container.querySelector('[data-testid="card-title-icon"]')).toBeNull();
    expect(container.querySelector('[data-testid="schedule-event-emoji"]')?.textContent).toContain(
      "🎂",
    );
  });

  it("shows the series emoji from the occurrence payload", () => {
    const event = makeTimelineItem({
      id: "rec-1:20260714T020000Z",
      title: "週會",
      source: "recurring",
      seriesId: "rec-1",
      emoji: "🔁",
      startTime: new Date(2026, 6, 14, 10, 0, 0).toISOString(),
      endTime: new Date(2026, 6, 14, 11, 0, 0).toISOString(),
    });
    const { container } = renderPanel({
      rangeEvents: [event],
      focusedDay: new Date(2026, 6, 14),
    });
    expect(container.querySelector('[data-testid="schedule-event-emoji"]')?.textContent).toContain(
      "🔁",
    );
    expect(container.querySelector('[data-testid="card-title-icon"]')).toBeNull();
  });

  it("puts subscription provenance on its own row and hides dismiss", () => {
    const event = makeTimelineItem({
      id: "sub-1",
      title: "Open Office Hours",
      source: "subscribed:DemoPub/Open",
      body: "Walk-in questions",
      location: "Lobby",
      startTime: new Date(2026, 6, 14, 14, 0, 0).toISOString(),
      endTime: new Date(2026, 6, 14, 15, 0, 0).toISOString(),
    });
    const { container } = renderPanel({
      rangeEvents: [event],
      focusedDay: new Date(2026, 6, 14),
    });

    const statusWorkset = container.querySelector(
      '[data-testid="timeline-event-list-status-workset"]',
    );
    const provenance = container.querySelector(
      '[data-testid="timeline-event-list-provenance"]',
    );
    expect(statusWorkset?.textContent).toContain("工作集：一般");
    expect(statusWorkset?.textContent).not.toContain("訂閱");
    expect(provenance?.textContent).toContain("訂閱：DemoPub/Open");
    expect(provenance?.parentElement).not.toBe(statusWorkset);
    expect(container.querySelector('[data-testid="timeline-event-list-dismiss"]')).toBeNull();
    expect(container.textContent).not.toContain("從時間軸拿掉");
  });

  it("keeps dismiss on local user events", () => {
    const event = makeTimelineItem({
      id: "user-local",
      title: "本機會議",
      source: "user",
      origin: "manual",
      startTime: new Date(2026, 6, 14, 10, 0, 0).toISOString(),
      endTime: new Date(2026, 6, 14, 11, 0, 0).toISOString(),
    });
    const { container } = renderPanel({
      rangeEvents: [event],
      focusedDay: new Date(2026, 6, 14),
    });
    expect(container.querySelector('[data-testid="timeline-event-list-dismiss"]')).not.toBeNull();
    expect(container.textContent).toContain("從時間軸拿掉");
  });
});
