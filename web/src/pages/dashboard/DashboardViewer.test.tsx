import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// --- Mocks ---

const mockNavigate = vi.fn();

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({}),
}));

vi.mock("../../context/ToastContext", async () =>
  (await import("../../test/context-mocks")).toastContextModuleMock());

vi.mock("../../context/TaskCatalogContext", async () =>
  (await import("../../test/context-mocks")).taskCatalogModuleMock());

vi.mock("../../context/AnalysisStatusContext", () => ({
  useAnalysisStatus: () => ({
    activeAnalyses: new Map(),
    queueStatus: null,
  }),
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

vi.mock("../../api/tasks", () => ({
  deleteTask: vi.fn().mockResolvedValue(undefined),
  toggleTaskActive: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../api/items", () => ({
  listItems: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../api/worksets", () => ({
  createWorkset: vi.fn().mockResolvedValue({
    id: "ws-new",
    name: "Alpha",
    isSystem: false,
    createdAt: null,
    updatedAt: null,
  }),
  renameWorkset: vi.fn().mockResolvedValue({
    id: "ws-1",
    name: "Ops Renamed",
    isSystem: false,
    createdAt: null,
    updatedAt: null,
  }),
  deleteWorkset: vi.fn().mockResolvedValue(undefined),
}));

import {
  makeAnalysisTask,
  mockShowToast,
  resetTaskCatalogState,
  taskCatalogState,
} from "../../test/context-mocks";
import { createWorkset } from "../../api/worksets";
import {
  TASKS_MODE_FILTER_STORAGE_KEY,
  TASKS_SEARCH_STORAGE_KEY,
  SHOW_SYSTEM_TASKS_STORAGE_KEY,
} from "../../domain/tasks/systemTaskCatalog";
import {
  getHideSystemTasksLabel,
  getShowSystemTasksLabel,
  getSystemTasksSectionTitle,
} from "../../domain/tasks/taskPageCopy";
import { DashboardViewer } from "./DashboardViewer";
import type { AnalysisTask } from "../../types";

const mockCreateWorkset = vi.mocked(createWorkset);

function createMockTask(overrides: Partial<AnalysisTask> = {}): AnalysisTask {
  return makeAnalysisTask({ name: "Test Task", description: null, ...overrides });
}

describe("DashboardViewer", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    mockNavigate.mockReset();
    mockShowToast.mockReset();
    mockCreateWorkset.mockClear();
    resetTaskCatalogState();
    window.localStorage.removeItem(SHOW_SYSTEM_TASKS_STORAGE_KEY);
    window.localStorage.removeItem(TASKS_MODE_FILTER_STORAGE_KEY);
    window.sessionStorage.removeItem(TASKS_SEARCH_STORAGE_KEY);
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

  it("shows empty state when no tasks exist", () => {
    taskCatalogState.tasks = [];

    act(() => {
      root = createRoot(container);
      root.render(<DashboardViewer />);
    });

    // EmptyState renders role="status" and contains the title text
    const emptyState = container.querySelector('[role="status"]');
    expect(emptyState).not.toBeNull();
    expect(container.textContent).toContain("尚無任務");
  });

  it("shows an error toast without adding a retry banner when task loading fails", () => {
    taskCatalogState.taskLoadError = "Network connection failed";

    act(() => {
      root = createRoot(container);
      root.render(<DashboardViewer />);
    });

    expect(mockShowToast).toHaveBeenCalledWith("Network connection failed", "error");
    expect(container.textContent).not.toContain("Network connection failed");
    expect(container.querySelector('[aria-label="重試載入"]')).toBeNull();
  });

  it("renders toolbar and task cards when tasks exist", () => {
    taskCatalogState.tasks = [
      createMockTask({ id: "t1", name: "Task Alpha" }),
      createMockTask({ id: "t2", name: "Task Beta" }),
    ];

    act(() => {
      root = createRoot(container);
      root.render(<DashboardViewer />);
    });

    const toolbar = container.querySelector('[data-testid="tasks-toolbar"]');
    expect(toolbar).not.toBeNull();
    expect(toolbar!.className).toContain("im-control-bar");
    expect(container.textContent).toContain("新增任務");
    expect(container.textContent).toContain("Task Alpha");
    expect(container.textContent).toContain("Task Beta");
  });

  it("does not show empty state when tasks exist", () => {
    taskCatalogState.tasks = [createMockTask({ id: "t1", name: "Active Task" })];

    act(() => {
      root = createRoot(container);
      root.render(<DashboardViewer />);
    });

    const emptyState = container.querySelector('[role="status"]');
    expect(emptyState).toBeNull();
  });

  it("shows create task button when tasks exist", () => {
    taskCatalogState.tasks = [createMockTask({ id: "t1", name: "Active Task" })];

    act(() => {
      root = createRoot(container);
      root.render(<DashboardViewer />);
    });

    const createBtn = container.querySelector('[aria-label="新增任務"]');
    expect(createBtn).not.toBeNull();
    expect(createBtn?.textContent).toContain("新增任務");
  });

  it("does not show error banner when no error", () => {
    taskCatalogState.tasks = [createMockTask()];
    taskCatalogState.taskLoadError = null;

    act(() => {
      root = createRoot(container);
      root.render(<DashboardViewer />);
    });

    const retryButton = container.querySelector('[aria-label="重試載入"]');
    expect(retryButton).toBeNull();
  });

  it("hides system task cards by default", () => {
    taskCatalogState.tasks = [createMockTask({ id: "t1", name: "Active Task" })];

    act(() => {
      root = createRoot(container);
      root.render(<DashboardViewer />);
    });

    expect(container.querySelector('[data-testid="system-tasks-section"]')).toBeNull();
    expect(container.textContent).not.toContain(getSystemTasksSectionTitle());
    expect(
      container.querySelector('[data-testid="toggle-system-tasks"]')?.getAttribute("aria-label"),
    ).toBe(getShowSystemTasksLabel());
    expect(container.textContent).not.toContain("新建工作集");
  });

  it("shows system and virtual cards after toggling, without edit or delete controls", () => {
    taskCatalogState.tasks = [createMockTask({ id: "t1", name: "Active Task" })];

    act(() => {
      root = createRoot(container);
      root.render(<DashboardViewer />);
    });

    const toggle = container.querySelector(
      '[data-testid="toggle-system-tasks"]',
    ) as HTMLButtonElement | null;
    expect(toggle).not.toBeNull();

    act(() => {
      toggle!.click();
    });

    expect(container.querySelector('[data-testid="system-tasks-section"]')).not.toBeNull();
    expect(container.textContent).toContain(getSystemTasksSectionTitle());
    expect(
      container.querySelector('[data-testid="system-task-card-user-or-assistant"]'),
    ).not.toBeNull();
    expect(container.textContent).toContain("用戶或助手");
    expect(container.textContent).toContain("一般");
    expect(container.querySelector('[data-testid="system-task-card-collector"]')).not.toBeNull();
    expect(toggle?.getAttribute("aria-label")).toBe(getHideSystemTasksLabel());

    const systemSection = container.querySelector('[data-testid="system-tasks-section"]');
    expect(systemSection?.querySelector('[aria-label^="Edit "]')).toBeNull();
    expect(systemSection?.querySelector('[aria-label^="Delete "]')).toBeNull();
    expect(systemSection?.querySelector('button[role="switch"]')).toBeNull();
  });

  it("exposes the system-tasks toggle when there are no editable tasks", () => {
    taskCatalogState.tasks = [];

    act(() => {
      root = createRoot(container);
      root.render(<DashboardViewer />);
    });

    const toggle = container.querySelector('[data-testid="toggle-system-tasks"]');
    expect(toggle).not.toBeNull();
    expect(toggle?.getAttribute("aria-label")).toBe(getShowSystemTasksLabel());
    expect(container.textContent).not.toContain("新建工作集");
    expect(
      [...container.querySelectorAll('[role="tab"]')].some((tab) => tab.textContent === "工作集"),
    ).toBe(true);

    act(() => {
      (toggle as HTMLButtonElement).click();
    });

    expect(container.querySelector('[data-testid="system-tasks-section"]')).not.toBeNull();
  });

  it("opens an in-app dialog to create a workset (no window.prompt)", async () => {
    taskCatalogState.tasks = [];
    taskCatalogState.worksets = [
      { id: "__user__", name: "一般", isSystem: true, createdAt: null, updatedAt: null },
    ];
    const promptSpy = vi.spyOn(window, "prompt").mockImplementation(() => {
      throw new Error("prompt() is not supported.");
    });

    act(() => {
      root = createRoot(container);
      root.render(<DashboardViewer />);
    });

    const worksetTab = [...container.querySelectorAll('[role="tab"]')].find(
      (tab) => tab.textContent === "工作集",
    ) as HTMLButtonElement;
    act(() => {
      worksetTab.click();
    });

    const createBtn = container.querySelector(
      '[data-testid="dashboard-create-workset"]',
    ) as HTMLButtonElement;
    expect(createBtn).toBeTruthy();
    act(() => {
      createBtn.click();
    });

    expect(document.querySelector('[data-testid="workset-name-dialog"]')).toBeTruthy();
    const input = document.querySelector(
      '[data-testid="workset-name-input"]',
    ) as HTMLInputElement;
    expect(input).toBeTruthy();
    const nativeSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    act(() => {
      nativeSetter?.call(input, "Alpha");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const submit = document.querySelector(
      '[data-testid="workset-name-submit"]',
    ) as HTMLButtonElement;
    await act(async () => {
      submit.click();
      await Promise.resolve();
    });

    expect(promptSpy).not.toHaveBeenCalled();
    expect(mockCreateWorkset).toHaveBeenCalledWith("Alpha");
    promptSpy.mockRestore();
  });

  it("shows workset groups with zero tasks when viewing by workset", () => {
    window.localStorage.removeItem("im:tasks:grouping-view");
    taskCatalogState.tasks = [];
    taskCatalogState.worksets = [
      { id: "__user__", name: "一般", isSystem: true, createdAt: null, updatedAt: null },
      { id: "ws-1", name: "Ops", isSystem: false, createdAt: null, updatedAt: null },
    ];

    act(() => {
      root = createRoot(container);
      root.render(<DashboardViewer />);
    });

    const worksetTab = [...container.querySelectorAll('[role="tab"]')].find(
      (tab) => tab.textContent === "工作集",
    ) as HTMLButtonElement;
    expect(worksetTab).toBeTruthy();
    act(() => {
      worksetTab.click();
    });

    expect(container.textContent).toContain("一般");
    expect(container.textContent).toContain("Ops");
    expect(container.textContent).toContain("新建工作集");
    expect(container.textContent).not.toContain("建立新任務");
    expect(container.querySelector('[data-testid="workset-card-__user__"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="workset-card-ws-1"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="toggle-system-tasks"]')).toBeNull();
    expect(container.querySelector('[data-testid="toggle-system-worksets"]')).toBeTruthy();
    expect(
      container.querySelector('[data-testid="toggle-system-worksets"]')?.getAttribute("aria-label"),
    ).toBe("隱藏系統工作集");
    expect(container.querySelector('[data-testid="system-task-card-user-or-assistant"]')).toBeNull();
  });

  it("restores mode filter from localStorage", () => {
    window.localStorage.setItem(TASKS_MODE_FILTER_STORAGE_KEY, JSON.stringify("recurring"));
    taskCatalogState.tasks = [
      createMockTask({ id: "t1", name: "Leaderboard Task", analysisMode: "leaderboard" }),
      createMockTask({ id: "t2", name: "Calendar Task", analysisMode: "recurring" }),
    ];

    act(() => {
      root = createRoot(container);
      root.render(<DashboardViewer />);
    });

    expect(container.textContent).toContain("Calendar Task");
    expect(container.textContent).not.toContain("Leaderboard Task");
  });

  it("opens project detail route when a project card is selected", () => {
    taskCatalogState.tasks = [
      createMockTask({ id: "proj-1", name: "Launch", analysisMode: "project" }),
    ];

    act(() => {
      root = createRoot(container);
      root.render(<DashboardViewer />);
    });

    const card = container.querySelector('[data-testid="task-card-proj-1"]') as HTMLElement | null;
    expect(card).not.toBeNull();
    act(() => {
      card!.click();
    });

    expect(mockNavigate).toHaveBeenCalledWith("/tasks/proj-1/project");
  });

  it("hides child recurring cards that belong to a project", () => {
    taskCatalogState.tasks = [
      createMockTask({ id: "proj-1", name: "Launch", analysisMode: "project" }),
      createMockTask({
        id: "child-1",
        name: "Hidden child",
        analysisMode: "recurring",
        parentTaskId: "proj-1",
      }),
    ];

    act(() => {
      root = createRoot(container);
      root.render(<DashboardViewer />);
    });

    expect(container.textContent).toContain("Launch");
    expect(container.textContent).not.toContain("Hidden child");
    expect(container.querySelector('[data-testid="task-card-child-1"]')).toBeNull();
  });

  describe("workset grouping view", () => {
    beforeEach(() => {
      window.localStorage.removeItem("im:tasks:grouping-view");
      taskCatalogState.worksets = [
        { id: "__user__", name: "一般", isSystem: true, createdAt: null, updatedAt: null },
        { id: "ws-1", name: "Ops", isSystem: false, createdAt: null, updatedAt: null },
      ];
      taskCatalogState.tasks = [
        createMockTask({ id: "t1", name: "Assigned Task", worksetId: "ws-1" }),
        createMockTask({ id: "t2", name: "Unassigned Task", worksetId: null }),
      ];
    });

    afterEach(() => {
      window.localStorage.removeItem("im:tasks:grouping-view");
    });

    it("groups tasks by workset with a separate unassigned section", () => {
      act(() => {
        root = createRoot(container);
        root.render(<DashboardViewer />);
      });

      const worksetTab = [...container.querySelectorAll('[role="tab"]')].find(
        (tab) => tab.textContent === "工作集",
      ) as HTMLButtonElement;
      expect(worksetTab).toBeTruthy();
      act(() => {
        worksetTab.click();
      });

      expect(container.textContent).toContain("一般");
      expect(container.textContent).toContain("Ops");
      expect(container.textContent).toContain("未歸屬");
      expect(container.textContent).toContain("Assigned Task");
      expect(container.textContent).toContain("Unassigned Task");
      expect(container.querySelector('[data-testid="workset-card-__user__"]')).toBeTruthy();
      expect(container.querySelector('[data-testid="toggle-system-tasks"]')).toBeNull();
      expect(container.querySelector('[data-testid="toggle-system-worksets"]')).toBeTruthy();
      expect(container.querySelector('[data-testid="dashboard-create-workset"]')).toBeTruthy();
    });

    it("shows rename/delete controls for named workset groups but not for unassigned", () => {
      act(() => {
        root = createRoot(container);
        root.render(<DashboardViewer />);
      });

      const worksetTab = [...container.querySelectorAll('[role="tab"]')].find(
        (tab) => tab.textContent === "工作集",
      ) as HTMLButtonElement;
      act(() => {
        worksetTab.click();
      });

      const opsCard = container.querySelector('[data-testid="workset-card-ws-1"]');
      const generalCard = container.querySelector('[data-testid="workset-card-__user__"]');
      expect(opsCard?.textContent).toContain("重新命名");
      expect(opsCard?.textContent).toContain("刪除");
      expect(generalCard?.textContent).toContain("內建");
      expect(generalCard?.textContent ?? "").not.toContain("重新命名");
      expect(container.textContent).toContain("未歸屬");
    });
  });
});
