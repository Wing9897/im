/**
 * Unit tests for TimelineControlBar.
 *
 * Coverage for complex conditional rendering (scale list varies by view mode)
 * and many user interaction handlers (task selector, view mode buttons, scale
 * buttons, cursor navigation).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { TimelineControlBar } from "./TimelineControlBar";
import type { TimelineScale } from "../../../domain/timeline/dateUtils";
import { SYSTEM_WORKSET_ID } from "../../../types/worksets";
import type { SourceFilterSelection } from "../../../domain/tasks/sourceFilterSelection";
import { ensureZhHantLocale, i18n, wrapWithI18n } from "../../../test/i18nHarness";

interface RenderOpts {
  selectedSources?: SourceFilterSelection;
  setSelectedSources?: (v: SourceFilterSelection) => void;
  timelineTasks?: { id: string; name: string }[];
  worksets?: { id: string; name: string }[];
  expandTasks?: { id: string; name?: string; worksetId?: string | null }[];
  viewMode?: "calendar" | "gantt";
  setViewMode?: (m: "calendar" | "gantt") => void;
  timeScale?: TimelineScale;
  onJumpTo?: (s: TimelineScale) => void;
  onMoveCursor?: (delta: number) => void;
  visibleRangeLabel?: string;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onAddEvent?: () => void;
  showLoadingIndicator?: boolean;
  loadingLabel?: string;
}

function renderControlBar(opts: RenderOpts = {}) {
  const props = {
    selectedSources: opts.selectedSources ?? null,
    setSelectedSources: opts.setSelectedSources ?? (() => {}),
    timelineTasks: opts.timelineTasks ?? [],
    worksets: opts.worksets,
    expandTasks: opts.expandTasks,
    viewMode: opts.viewMode ?? ("calendar" as const),
    setViewMode: opts.setViewMode ?? (() => {}),
    timeScale: opts.timeScale ?? ("month" as TimelineScale),
    onJumpTo: opts.onJumpTo ?? (() => {}),
    onMoveCursor: opts.onMoveCursor ?? (() => {}),
    visibleRangeLabel: opts.visibleRangeLabel ?? "2025年1月",
    isFullscreen: opts.isFullscreen,
    onToggleFullscreen: opts.onToggleFullscreen,
    onAddEvent: opts.onAddEvent,
    showLoadingIndicator: opts.showLoadingIndicator,
    loadingLabel: opts.loadingLabel,
  };
  const container = document.createElement("div");
  act(() => {
    createRoot(container).render(
      wrapWithI18n(createElement(TimelineControlBar, props)),
    );
  });
  return container;
}

function findButtonByText(container: HTMLElement, text: string): HTMLButtonElement | null {
  const buttons = container.querySelectorAll("button");
  for (const b of Array.from(buttons)) {
    if (b.textContent === text) return b as HTMLButtonElement;
  }
  return null;
}

describe("TimelineControlBar", () => {
  beforeEach(async () => {
    await ensureZhHantLocale();
  });

  afterEach(() => {
    document
      .querySelectorAll('[data-testid="source-filter-dialog"]')
      .forEach((node) => node.remove());
  });

  it("renders multi-select filter with tasks and user/assistant in calendar mode", () => {
    const container = renderControlBar({
      timelineTasks: [
        { id: "t1", name: "Task 1" },
        { id: "t2", name: "Task 2" },
      ],
      worksets: [{ id: SYSTEM_WORKSET_ID, name: "General" }],
      // Mirror production TimelinePage: expandTasks include name (catalog-merge
      // without name is covered by SourceFilterDialog.test).
      expandTasks: [
        { id: "t1", name: "Task 1", worksetId: SYSTEM_WORKSET_ID },
        { id: "t2", name: "Task 2", worksetId: SYSTEM_WORKSET_ID },
      ],
      viewMode: "calendar",
    });
    expect(container.querySelector('[data-testid="timeline-source-filter"]')).not.toBeNull();
    const filterBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="board-source-filter"]',
    )!;
    act(() => {
      filterBtn.click();
    });
    // Dialog tree interaction covered by SourceFilterDialog.test; toolbar only mounts control.
    expect(document.querySelector('[data-testid="source-filter-dialog"]')).not.toBeNull();
    expect(
      document.querySelector(`[data-testid="board-workset-filter-${SYSTEM_WORKSET_ID}"]`),
    ).not.toBeNull();
  });

  it("lists calendar tasks in the multi-select filter and checks them by default", () => {
    const container = renderControlBar({
      timelineTasks: [
        { id: "timeline-task-1", name: "Timeline Analysis" },
        { id: "cal-task-1", name: "Weekly Standup (Calendar)" },
      ],
      worksets: [{ id: SYSTEM_WORKSET_ID, name: "一般" }],
      expandTasks: [
        { id: "timeline-task-1", name: "Timeline Analysis", worksetId: SYSTEM_WORKSET_ID },
        { id: "cal-task-1", name: "Weekly Standup (Calendar)", worksetId: SYSTEM_WORKSET_ID },
      ],
    });
    const filterBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="board-source-filter"]',
    )!;
    act(() => {
      filterBtn.click();
    });
    act(() => {
      document
        .querySelector<HTMLButtonElement>(
          `[data-testid="board-workset-expand-${SYSTEM_WORKSET_ID}"]`,
        )
        ?.click();
    });
    expect(
      document.querySelector('[data-testid="board-source-filter-timeline-task-1"]'),
    ).not.toBeNull();
    const checkbox = document.querySelector<HTMLInputElement>(
      '[data-testid="board-source-filter-cal-task-1"]',
    )!;
    expect(checkbox).not.toBeNull();
    expect(checkbox.checked).toBe(true);
  });

  it("keeps user/assistant option in the multi-select filter in gantt mode", () => {
    const container = renderControlBar({
      timelineTasks: [{ id: "t1", name: "Task 1" }],
      worksets: [{ id: SYSTEM_WORKSET_ID, name: "General" }],
      expandTasks: [{ id: "t1", name: "Task 1", worksetId: SYSTEM_WORKSET_ID }],
      viewMode: "gantt",
    });
    const filterBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="board-source-filter"]',
    )!;
    act(() => {
      filterBtn.click();
    });
    expect(
      document.querySelector(`[data-testid="board-workset-filter-${SYSTEM_WORKSET_ID}"]`),
    ).not.toBeNull();
  });

  it("renders 3 scale buttons (日/週/月) in calendar mode", () => {
    const container = renderControlBar({ viewMode: "calendar" });
    expect(findButtonByText(container, "日")).not.toBeNull();
    expect(findButtonByText(container, "週")).not.toBeNull();
    expect(findButtonByText(container, "月")).not.toBeNull();
    expect(findButtonByText(container, "季")).toBeNull();
    expect(findButtonByText(container, "年")).toBeNull();
  });

  it("renders 5 scale buttons (日/週/月/季/年) in gantt mode", () => {
    const container = renderControlBar({ viewMode: "gantt" });
    expect(findButtonByText(container, "日")).not.toBeNull();
    expect(findButtonByText(container, "週")).not.toBeNull();
    expect(findButtonByText(container, "月")).not.toBeNull();
    expect(findButtonByText(container, "季")).not.toBeNull();
    expect(findButtonByText(container, "年")).not.toBeNull();
  });

  it("renders the visible range label", () => {
    const container = renderControlBar({ visibleRangeLabel: "2025年5月" });
    expect(container.textContent).toContain("2025年5月");
  });

  it("calls setViewMode when calendar/gantt buttons are clicked", () => {
    const setViewMode = vi.fn();
    const container = renderControlBar({ viewMode: "calendar", setViewMode });
    const ganttBtn = findButtonByText(container, "甘特")!;
    act(() => {
      ganttBtn.click();
    });
    expect(setViewMode).toHaveBeenCalledWith("gantt");
  });

  it("calls onJumpTo when a scale button is clicked", () => {
    const onJumpTo = vi.fn();
    const container = renderControlBar({ viewMode: "gantt", onJumpTo, timeScale: "month" });
    const yearBtn = findButtonByText(container, "年")!;
    act(() => {
      yearBtn.click();
    });
    expect(onJumpTo).toHaveBeenCalledWith("year");
  });

  it("calls onJumpTo with current scale when 本日 (today) icon button is clicked", () => {
    const onJumpTo = vi.fn();
    const container = renderControlBar({ timeScale: "week", onJumpTo });
    const todayBtn = container.querySelector<HTMLButtonElement>(
      `button[aria-label="${i18n.t("timeline:toolbar.todayAria")}"]`,
    )!;
    act(() => {
      todayBtn.click();
    });
    expect(onJumpTo).toHaveBeenCalledWith("week");
  });

  it("calls onMoveCursor with -1 when the previous-period button is clicked", () => {
    const onMoveCursor = vi.fn();
    const container = renderControlBar({ onMoveCursor });
    const prevBtn = container.querySelector<HTMLButtonElement>(
      `[aria-label="${i18n.t("timeline:toolbar.prevPeriodAria")}"]`,
    )!;
    act(() => {
      prevBtn.click();
    });
    expect(onMoveCursor).toHaveBeenCalledWith(-1);
  });

  it("calls onMoveCursor with +1 when the next-period button is clicked", () => {
    const onMoveCursor = vi.fn();
    const container = renderControlBar({ onMoveCursor });
    const nextBtn = container.querySelector<HTMLButtonElement>(
      `[aria-label="${i18n.t("timeline:toolbar.nextPeriodAria")}"]`,
    )!;
    act(() => {
      nextBtn.click();
    });
    expect(onMoveCursor).toHaveBeenCalledWith(1);
  });

  it("renders multi-select task filter control", () => {
    const container = renderControlBar({
      timelineTasks: [{ id: "t1", name: "Task 1" }],
    });
    expect(container.querySelector('[data-testid="timeline-source-filter"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="board-source-filter"]')).not.toBeNull();
  });

  it("uses single-row control-bar chrome with toolbar-sized task filter", () => {
    const container = renderControlBar({
      timelineTasks: [{ id: "t1", name: "Task 1" }],
    });
    const bar = container.querySelector('[data-testid="timeline-control-bar"]');
    expect(bar).not.toBeNull();
    expect(bar!.className).toContain("im-control-bar");
    expect(bar!.className).toContain("flex-nowrap");
    // toolbar variant uses PillButton, not the 22px board widget chrome.
    expect(container.querySelector(".board-widget-frame__btn")).toBeNull();
  });

  it("hides fullscreen toggle when onToggleFullscreen is omitted", () => {
    const container = renderControlBar();
    expect(container.querySelector("[data-testid='timeline-fullscreen-toggle']")).toBeNull();
  });

  it("calls onToggleFullscreen and reflects pressed state", () => {
    const onToggleFullscreen = vi.fn();
    const container = renderControlBar({ isFullscreen: true, onToggleFullscreen });
    const btn = container.querySelector<HTMLButtonElement>(
      "[data-testid='timeline-fullscreen-toggle']",
    )!;
    expect(btn.getAttribute("aria-pressed")).toBe("true");
    expect(btn.getAttribute("aria-label")).toBe(i18n.t("timeline:toolbar.exitFullscreen"));
    act(() => {
      btn.click();
    });
    expect(onToggleFullscreen).toHaveBeenCalledTimes(1);
  });

  it("calls onAddEvent with no args (does not forward the click event)", () => {
    const onAddEvent = vi.fn();
    const container = renderControlBar({ onAddEvent });
    const addBtn = container.querySelector<HTMLButtonElement>(
      `button[aria-label="${i18n.t("timeline:toolbar.addEvent")}"]`,
    )!;
    act(() => {
      addBtn.click();
    });
    expect(onAddEvent).toHaveBeenCalledTimes(1);
    expect(onAddEvent).toHaveBeenCalledWith();
  });

  it("keeps a reserved loading slot so the spinner does not shift toolbar layout", () => {
    const idle = renderControlBar({ showLoadingIndicator: false });
    const idleSlot = idle.querySelector('[data-testid="timeline-toolbar-loading"]');
    expect(idleSlot).not.toBeNull();
    expect(idleSlot!.className).toContain("invisible");
    expect(idleSlot!.querySelector(".im-refresh-indicator")).toBeNull();

    const loading = renderControlBar({ showLoadingIndicator: true, loadingLabel: "載入中" });
    const loadingSlot = loading.querySelector('[data-testid="timeline-toolbar-loading"]');
    expect(loadingSlot).not.toBeNull();
    expect(loadingSlot!.className).not.toContain("invisible");
    expect(loadingSlot!.querySelector(".im-refresh-indicator")).not.toBeNull();
    expect(loadingSlot!.getAttribute("aria-hidden")).toBe("false");
  });
});
