/**
 * Unit tests for TimelineControlBar.
 *
 * Validates: Requirement 8.1 — coverage for components with complex
 * conditional rendering (scale list varies by view mode) and many user
 * interaction handlers (task selector, view mode buttons, scale buttons,
 * cursor navigation).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import i18n from "../../../i18n";
import { setAppLocale } from "../../../i18n/locale";
import { TimelineControlBar } from "./TimelineControlBar";
import type { TimelineScale } from "../../../domain/timeline/dateUtils";
import { USER_EVENTS_FILTER_ID } from "../../../domain/timeline/userEvents";

interface RenderOpts {
  selectedTaskIds?: string[] | null;
  setSelectedTaskIds?: (v: string[] | null) => void;
  timelineTasks?: { id: string; name: string }[];
  viewMode?: "calendar" | "gantt";
  setViewMode?: (m: "calendar" | "gantt") => void;
  timeScale?: TimelineScale;
  onJumpTo?: (s: TimelineScale) => void;
  onMoveCursor?: (delta: number) => void;
  visibleRangeLabel?: string;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

function renderControlBar(opts: RenderOpts = {}) {
  const props = {
    selectedTaskIds: opts.selectedTaskIds ?? null,
    setSelectedTaskIds: opts.setSelectedTaskIds ?? (() => {}),
    timelineTasks: opts.timelineTasks ?? [],
    viewMode: opts.viewMode ?? ("calendar" as const),
    setViewMode: opts.setViewMode ?? (() => {}),
    timeScale: opts.timeScale ?? ("month" as TimelineScale),
    onJumpTo: opts.onJumpTo ?? (() => {}),
    onMoveCursor: opts.onMoveCursor ?? (() => {}),
    visibleRangeLabel: opts.visibleRangeLabel ?? "2025年1月",
    isFullscreen: opts.isFullscreen,
    onToggleFullscreen: opts.onToggleFullscreen,
  };
  const container = document.createElement("div");
  act(() => {
    createRoot(container).render(
      createElement(I18nextProvider, { i18n }, createElement(TimelineControlBar, props)),
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
    setAppLocale("zh-Hant");
    await i18n.changeLanguage("zh-Hant");
  });

  it("renders multi-select filter with tasks and user/assistant in calendar mode", () => {
    const container = renderControlBar({
      timelineTasks: [
        { id: "t1", name: "Task 1" },
        { id: "t2", name: "Task 2" },
      ],
      viewMode: "calendar",
    });
    const filterBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="board-task-filter"]',
    )!;
    act(() => {
      filterBtn.click();
    });
    expect(document.querySelector('[data-testid="board-task-filter-t1"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="board-task-filter-t2"]')).not.toBeNull();
    expect(
      document.querySelector(`[data-testid="board-task-filter-${USER_EVENTS_FILTER_ID}"]`),
    ).not.toBeNull();
  });

  it("keeps user/assistant option in the multi-select filter in gantt mode", () => {
    const container = renderControlBar({
      timelineTasks: [{ id: "t1", name: "Task 1" }],
      viewMode: "gantt",
    });
    const filterBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="board-task-filter"]',
    )!;
    act(() => {
      filterBtn.click();
    });
    expect(document.querySelector('[data-testid="board-task-filter-t1"]')).not.toBeNull();
    expect(
      document.querySelector(`[data-testid="board-task-filter-${USER_EVENTS_FILTER_ID}"]`),
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
    expect(container.querySelector('[data-testid="timeline-task-filter"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="board-task-filter"]')).not.toBeNull();
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
});
