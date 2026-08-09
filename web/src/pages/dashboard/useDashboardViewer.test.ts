import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("../../context/ToastContext", async () =>
  (await import("../../test/context-mocks")).toastContextModuleMock());

vi.mock("../../context/TaskCatalogContext", async () =>
  (await import("../../test/context-mocks")).taskCatalogModuleMock());

const { analysisStatusState } = vi.hoisted(() => ({
  analysisStatusState: {
    activeAnalyses: new Map<string, { taskId: string; batchId: string; taskName: string }>(),
    queueStatus: null as null,
    analysisPaused: false,
  },
}));

vi.mock("../../context/AnalysisStatusContext", () => ({
  useAnalysisStatus: () => analysisStatusState,
}));

vi.mock("../../context/MonitorModeContext", () => ({
  useMonitorMode: () => ({
    monitorMode: "pages" as const,
    setMonitorMode: vi.fn(),
    openInPages: vi.fn(),
  }),
}));

vi.mock("../../hooks/useTaskAnalysisStats", async () =>
  (await import("../../test/task-analysis-stats-mock")).taskAnalysisStatsModuleMock());

vi.mock("../../hooks/useRefreshOnAnalysisEvent", () => ({
  useRefreshOnAnalysisEvent: vi.fn(),
}));

const { mockToggle } = vi.hoisted(() => ({
  mockToggle: vi.fn(),
}));

vi.mock("../../api/tasks", () => ({
  deleteTask: vi.fn().mockResolvedValue(undefined),
  toggleTaskActive: (...args: unknown[]) => mockToggle(...args),
}));

import {
  makeAnalysisTask,
  mockShowToast,
  resetTaskCatalogState,
} from "../../test/context-mocks";
import {
  makeTaskAnalysisStats,
  resetTaskAnalysisStatsState,
  taskAnalysisStatsState,
} from "../../test/task-analysis-stats-mock";
import {
  TASKS_SEARCH_STORAGE_KEY,
} from "../../domain/tasks/systemTaskCatalog";
import { useDashboardViewer } from "./useDashboardViewer";

let latest: ReturnType<typeof useDashboardViewer> | null = null;

function Harness() {
  latest = useDashboardViewer();
  return null;
}

describe("useDashboardViewer", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    latest = null;
    mockNavigate.mockReset();
    mockShowToast.mockReset();
    mockToggle.mockReset();
    analysisStatusState.activeAnalyses = new Map();
    analysisStatusState.queueStatus = null;
    analysisStatusState.analysisPaused = false;
    resetTaskCatalogState([
      makeAnalysisTask({ id: "task-alpha", name: "Alpha Task", description: "first" }),
      makeAnalysisTask({ id: "task-beta", name: "Beta Task", description: "second" }),
    ]);
    resetTaskAnalysisStatsState();
    taskAnalysisStatsState.taskStats = [
      makeTaskAnalysisStats({
        taskId: "task-alpha",
        queuedMessageCount: 3,
      }),
    ];
    mockToggle.mockResolvedValue({ isActive: false });
    window.sessionStorage.removeItem(TASKS_SEARCH_STORAGE_KEY);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  async function renderHook() {
    await act(async () => {
      root.render(createElement(Harness));
      await Promise.resolve();
    });
  }

  it("filters tasks by name and description", async () => {
    await renderHook();

    act(() => {
      latest!.setSearchQuery("beta");
    });

    expect(latest!.filteredTasks.map((task) => task.id)).toEqual(["task-beta"]);
  });

  it("restores search query from session storage", async () => {
    window.sessionStorage.setItem(TASKS_SEARCH_STORAGE_KEY, JSON.stringify("beta"));
    await renderHook();

    expect(latest!.searchQuery).toBe("beta");
    expect(latest!.filteredTasks.map((task) => task.id)).toEqual(["task-beta"]);
  });

  it("maps task stats to card stats", async () => {
    await renderHook();

    expect(latest!.statsMap.get("task-alpha")?.queuedMessageCount).toBe(3);
  });

  it("marks cards isRunning from activeAnalyses and clears when batch leaves", async () => {
    analysisStatusState.activeAnalyses = new Map([
      [
        "batch-a",
        { taskId: "task-alpha", batchId: "batch-a", taskName: "Alpha Task" },
      ],
      [
        "batch-b",
        { taskId: "task-beta", batchId: "batch-b", taskName: "Beta Task" },
      ],
    ]);
    await renderHook();

    expect(latest!.statsMap.get("task-alpha")?.isRunning).toBe(true);
    expect(latest!.statsMap.get("task-beta")?.isRunning).toBe(true);

    act(() => {
      analysisStatusState.activeAnalyses = new Map([
        [
          "batch-c",
          { taskId: "task-beta", batchId: "batch-c", taskName: "Beta Task" },
        ],
      ]);
      root.render(createElement(Harness));
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(latest!.statsMap.get("task-alpha")?.isRunning).toBe(false);
    expect(latest!.statsMap.get("task-beta")?.isRunning).toBe(true);
  });

  it("navigates to edit route from handleEdit", async () => {
    await renderHook();

    act(() => {
      latest!.handleEdit("task-beta");
    });

    expect(mockNavigate).toHaveBeenCalledWith("/tasks/task-beta/edit");
  });

  it("navigates to project detail from handleOpenProject", async () => {
    await renderHook();

    act(() => {
      latest!.handleOpenProject("proj-1");
    });

    expect(mockNavigate).toHaveBeenCalledWith("/tasks/proj-1/agent");
  });

  it("hides child recurring tasks from the grid", async () => {
    // Catalog still holds the child (parentTaskId); dashboard grid is top-level only.
    resetTaskCatalogState([
      makeAnalysisTask({ id: "proj-1", name: "Launch", analysisMode: "agent", outputCalendar: true }),
      makeAnalysisTask({
        id: "child-1",
        name: "Standup",
        analysisMode: "recurring",
        parentTaskId: "proj-1",
      }),
      makeAnalysisTask({ id: "event-1", name: "Watch", analysisMode: "intel_event" }),
    ]);
    await renderHook();

    expect(latest!.tasks.map((task) => task.id)).toEqual(["proj-1", "event-1"]);
    expect(latest!.filteredTasks.map((task) => task.id)).toEqual(["proj-1", "event-1"]);
  });
});
