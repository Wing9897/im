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
});
