import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../context/TaskCatalogContext", async () =>
  (await import("../test/context-mocks")).taskCatalogModuleMock());

import { TaskCard } from "./TaskCard";
import type { TaskCardProps, TaskCardStats } from "./TaskCard";
import type { AnalysisTask } from "../types/tasks";
import { resetTaskCatalogState, taskCatalogState } from "../test/context-mocks";

function createMockTask(overrides: Partial<AnalysisTask> = {}): AnalysisTask {
  return {
    id: "task-1",
    name: "Test Task",
    description: null,
    promptTemplate: "test prompt",
    analysisMode: "event",
    analysisTimeRange: "7d",
    version: 1,
    isActive: true,
    channelIds: [],
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

function createMockStats(overrides: Partial<TaskCardStats> = {}): TaskCardStats {
  return {
    unanalyzedCount: 5,
    queuedMessageCount: 0,
    analyzedCount: 10,
    isRunning: false,
    ...overrides,
  };
}

describe("TaskCard", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    resetTaskCatalogState();
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root!.unmount();
      });
    }
    root = null;
    container.remove();
  });

  function renderCard(props: Partial<TaskCardProps> = {}) {
    const defaultProps: TaskCardProps = {
      task: createMockTask(),
      stats: createMockStats(),
      onToggleActive: vi.fn().mockResolvedValue(undefined),
      onEdit: vi.fn(),
      onDelete: vi.fn(),
      ...props,
    };

    act(() => {
      root = createRoot(container);
      root.render(<TaskCard {...defaultProps} />);
    });

    return defaultProps;
  }

  it("renders the task name", () => {
    renderCard({ task: createMockTask({ name: "My Analysis Task" }) });

    expect(container.textContent).toContain("My Analysis Task");
  });

  it("shows reduced opacity and inactive icon when task is inactive", () => {
    renderCard({ task: createMockTask({ isActive: false }) });

    const card = container.querySelector('[data-testid="task-card-task-1"]') as HTMLElement;
    expect(card).not.toBeNull();
    expect(card.className).toContain("opacity-[0.72]");
    expect(
      container.querySelector('[data-testid="task-card-inactive-icon-task-1"]'),
    ).not.toBeNull();
    expect(container.textContent).toContain("已停用");
    // Toggle no longer duplicates the visible "停用" label next to the switch.
    const toggle = container.querySelector('[role="switch"]') as HTMLElement;
    expect(toggle.getAttribute("aria-label")).toBe("啟用");
    expect(toggle.textContent ?? "").not.toContain("停用");
  });

  it("shows opacity 1 when task is active", () => {
    renderCard({ task: createMockTask({ isActive: true }) });

    const card = container.querySelector('[data-testid="task-card-task-1"]') as HTMLElement;
    expect(card).not.toBeNull();
    expect(card.className).toContain("opacity-100");
    expect(
      container.querySelector('[data-testid="task-card-inactive-icon-task-1"]'),
    ).toBeNull();
    expect(container.textContent).not.toContain("已停用");
  });

  it('shows "執行中" indicator when isRunning is true', () => {
    renderCard({ stats: createMockStats({ isRunning: true }) });

    expect(container.textContent).toContain("執行中");
  });

  it('shows "閒置" indicator when isRunning is false', () => {
    renderCard({ stats: createMockStats({ isRunning: false }) });

    expect(container.textContent).toContain("閒置");
  });

  it("shows 循環任務 badge for recurring mode tasks", () => {
    renderCard({ task: createMockTask({ analysisMode: "recurring" }) });

    expect(container.textContent).toContain("循環任務");
  });

  it("does not show 循環任務 badge for non-recurring mode tasks", () => {
    renderCard({ task: createMockTask({ analysisMode: "event" }) });

    const allText = container.textContent ?? "";
    expect(allText).not.toContain("循環任務");
  });

  it("shows the analysis mode badge for every mode", () => {
    renderCard({ task: createMockTask({ analysisMode: "leaderboard" }) });
    expect(container.textContent).toContain("排行榜");
  });

  it("shows the matching AI staff avatar for analysis modes", () => {
    renderCard({ task: createMockTask({ analysisMode: "event" }) });
    expect(container.querySelector('[data-testid="ai-staff-avatar-eventIntel"]')).not.toBeNull();
  });

  it("shows leaderboard staff avatar for leaderboard tasks", () => {
    renderCard({ task: createMockTask({ analysisMode: "leaderboard" }) });
    expect(container.querySelector('[data-testid="ai-staff-avatar-leaderboard"]')).not.toBeNull();
  });

  it("omits AI staff avatar for calendar tasks", () => {
    renderCard({ task: createMockTask({ analysisMode: "recurring" }) });
    expect(container.querySelector('[data-testid^="ai-staff-avatar-"]')).toBeNull();
  });

  it("shows the workset name when the task has a worksetId", () => {
    taskCatalogState.worksets = [
      { id: "ws-1", name: "Ops", createdAt: null, updatedAt: null },
    ];
    renderCard({ task: createMockTask({ worksetId: "ws-1" }) });

    expect(container.textContent).toContain("Ops");
  });

  it("omits the workset label when the task has no worksetId", () => {
    taskCatalogState.worksets = [
      { id: "ws-1", name: "Ops", createdAt: null, updatedAt: null },
    ];
    renderCard({ task: createMockTask({ worksetId: null }) });

    expect(container.textContent).not.toContain("Ops");
  });

  it("calls onEdit when edit button is clicked", () => {
    const onEdit = vi.fn();
    renderCard({
      task: createMockTask({ id: "task-42", name: "Editable Task" }),
      onEdit,
    });

    const editButton = container.querySelector(
      '[aria-label="編輯 Editable Task"]',
    ) as HTMLElement;
    expect(editButton).not.toBeNull();

    act(() => {
      editButton.click();
    });

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledWith("task-42");
  });

  it("calls onDelete when delete button is clicked", () => {
    const onDelete = vi.fn();
    renderCard({
      task: createMockTask({ id: "task-99", name: "Deletable Task" }),
      onDelete,
    });

    const deleteButton = container.querySelector(
      '[aria-label="刪除 Deletable Task"]',
    ) as HTMLElement;
    expect(deleteButton).not.toBeNull();

    act(() => {
      deleteButton.click();
    });

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith("task-99");
  });

  it("shows attention error, retry count, and paused hint", () => {
    renderCard({
      stats: createMockStats({
        lastErrorMessage: "rate limited",
        retryCount: 2,
        analysisPaused: true,
      }),
    });

    expect(container.querySelector('[data-testid="task-card-error-task-1"]')?.textContent).toContain(
      "rate limited",
    );
    expect(container.querySelector('[data-testid="task-card-retry-task-1"]')?.textContent).toContain(
      "重試",
    );
    expect(container.querySelector('[data-testid="task-card-paused-task-1"]')).not.toBeNull();
  });

  it("uses simplified stat labels", () => {
    renderCard();
    expect(container.textContent).toContain("待分析");
    expect(container.textContent).toContain("排隊中");
    expect(container.textContent).toContain("已分析");
    expect(container.textContent).not.toContain("失敗");
    expect(container.textContent).not.toContain("重試中");
  });

  it("hides marker stats for project mode", () => {
    renderCard({
      task: createMockTask({ analysisMode: "project", name: "Proj" }),
      stats: createMockStats({ unanalyzedCount: 3852, analyzedCount: 0 }),
    });
    expect(container.querySelector('[data-testid="task-card-schedule-hint-task-1"]')).not.toBeNull();
    expect(container.textContent).toContain("進度以訊息游標推進");
    expect(container.textContent).not.toContain("3852");
    expect(container.textContent).not.toContain("待分析");
  });

  it("hides marker stats for recurring mode", () => {
    renderCard({
      task: createMockTask({
        analysisMode: "recurring",
        name: "Standup",
        rrule: "FREQ=DAILY",
      }),
    });
    expect(container.querySelector('[data-testid="task-card-schedule-hint-task-1"]')).not.toBeNull();
    expect(container.textContent).toContain("循環日程");
    expect(container.textContent).not.toContain("FREQ=DAILY");
    expect(container.textContent).not.toContain("待分析");

  });

  it("shows queued message count", () => {
    renderCard({ stats: createMockStats({ queuedMessageCount: 50 }) });
    expect(container.textContent).toContain("排隊中");
    expect(container.textContent).toContain("50");
  });

  it("calls onSelect when card body is clicked", () => {
    const onSelect = vi.fn();
    renderCard({
      task: createMockTask({ name: "Detail Task" }),
      onSelect,
    });

    const card = container.querySelector('[aria-label="查看任務詳情：Detail Task"]') as HTMLElement;
    expect(card).not.toBeNull();

    act(() => {
      card.click();
    });

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("keeps action controls inside the elevated card surface", () => {
    renderCard({ task: createMockTask({ name: "Layout Task" }) });

    const card = container.querySelector('[data-testid="task-card-task-1"]') as HTMLElement;
    const surface = card.querySelector(".im-material-elevated") as HTMLElement;
    const editButton = container.querySelector(
      '[aria-label="編輯 Layout Task"]',
    ) as HTMLElement;

    expect(surface).not.toBeNull();
    expect(surface.contains(editButton)).toBe(true);
    expect(surface.classList.contains("im-card-hover")).toBe(true);
    expect(editButton.className).toContain("im-icon-btn");
  });

  it("does not call onSelect when footer edit button is clicked", () => {
    const onSelect = vi.fn();
    const onEdit = vi.fn();
    renderCard({
      task: createMockTask({ name: "Detail Task" }),
      onSelect,
      onEdit,
    });

    const editButton = container.querySelector(
      '[aria-label="編輯 Detail Task"]',
    ) as HTMLElement;

    act(() => {
      editButton.click();
    });

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
