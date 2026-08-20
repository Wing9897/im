import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// --- Mocks ---

const mockNavigate = vi.fn();
let mockPathname = "/tasks";
let mockSearch = "";

const mockPipeline = vi.hoisted(() => ({
  current: {
    state: "complete" as const,
    showChecklist: false,
    loading: false,
  },
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({}),
  useLocation: () => ({ pathname: mockPathname, search: mockSearch }),
  useSearchParams: () => [
    new URLSearchParams(mockSearch.startsWith("?") ? mockSearch.slice(1) : mockSearch),
    vi.fn(),
  ],
  Link: ({ children, to }: { children?: unknown; to: string }) => (
    <a href={typeof to === "string" ? to : ""}>{children as never}</a>
  ),
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

vi.mock("../../hooks/usePipelineReadiness", () => ({
  usePipelineReadiness: () => mockPipeline.current,
}));

vi.mock("../../api/userEvents", () => ({
  listUserEventsPage: vi.fn().mockResolvedValue({ items: [], totalCount: 0, hasMore: false }),
}));

vi.mock("../../api/channels", () => ({
  listChannelsWithSources: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../api/worksets", () => ({
  createWorkset: vi.fn().mockResolvedValue({
    id: "ws-new",
    name: "Alpha",
    isSystem: false,
    notifyEnabled: true,
    externalEnabled: true,
    createdAt: null,
    updatedAt: null,
  }),
  renameWorkset: vi.fn().mockResolvedValue({
    id: "ws-1",
    name: "Ops Renamed",
    isSystem: false,
    notifyEnabled: true,
    externalEnabled: true,
    createdAt: null,
    updatedAt: null,
  }),
  deleteWorkset: vi.fn().mockResolvedValue(undefined),
  updateWorkset: vi.fn().mockResolvedValue({
    id: "ws-1",
    name: "Ops",
    isSystem: false,
    notifyEnabled: true,
    externalEnabled: true,
    createdAt: null,
    updatedAt: null,
  }),
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
  WORKSETS_SEARCH_STORAGE_KEY,
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

function typeInput(input: HTMLInputElement, value: string) {
  const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  act(() => {
    nativeSetter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("DashboardViewer", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    mockNavigate.mockReset();
    mockPathname = "/tasks";
    mockSearch = "";
    mockPipeline.current = {
      state: "complete",
      showChecklist: false,
      loading: false,
    };
    mockShowToast.mockReset();
    mockCreateWorkset.mockClear();
    resetTaskCatalogState();
    window.localStorage.removeItem(SHOW_SYSTEM_TASKS_STORAGE_KEY);
    window.localStorage.removeItem(TASKS_MODE_FILTER_STORAGE_KEY);
    window.sessionStorage.removeItem(TASKS_SEARCH_STORAGE_KEY);
    window.sessionStorage.removeItem(WORKSETS_SEARCH_STORAGE_KEY);
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
    mockPipeline.current = {
      state: "no_sources",
      showChecklist: true,
      loading: false,
    };
    taskCatalogState.tasks = [];

    act(() => {
      root = createRoot(container);
      root.render(<DashboardViewer />);
    });

    // EmptyState renders role="status" and contains the title text
    const emptyState = container.querySelector('[role="status"]');
    expect(emptyState).not.toBeNull();
    expect(container.textContent).toContain("開始情報管線");
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
    const search = toolbar!.querySelector('[data-testid="tasks-search"]') as HTMLInputElement;
    expect(search).toBeInstanceOf(HTMLInputElement);
    expect(search.placeholder).toBe("搜尋任務…");
    expect(search.getAttribute("data-im-search")).not.toBeNull();
    expect(container.textContent).toContain("新增任務");
    expect(container.textContent).toContain("Task Alpha");
    expect(container.textContent).toContain("Task Beta");
  });

  it("keeps a visible search TextField in the tasks toolbar on /tasks", () => {
    mockPathname = "/tasks";
    taskCatalogState.tasks = [
      createMockTask({ id: "t1", name: "Task Alpha" }),
      createMockTask({ id: "t2", name: "Task Beta" }),
    ];

    act(() => {
      root = createRoot(container);
      root.render(<DashboardViewer />);
    });

    const toolbar = container.querySelector('[data-testid="tasks-toolbar"]') as HTMLElement;
    expect(toolbar).not.toBeNull();
    expect(toolbar.getAttribute("role")).toBe("toolbar");
    const search = toolbar.querySelector('[data-testid="tasks-search"]') as HTMLInputElement;
    expect(search).toBeInstanceOf(HTMLInputElement);
    expect(document.body.contains(search)).toBe(true);
    expect(search.className.split(/\s+/)).not.toContain("hidden");
    expect(search.getAttribute("aria-hidden")).not.toBe("true");
    expect(search.placeholder).toBe("搜尋任務…");
    expect(toolbar.querySelector('[data-testid="toggle-system-tasks"]')).not.toBeNull();
    expect(toolbar.textContent).toContain("新增任務");
  });

  it("filters tasks by name from the toolbar search", () => {
    taskCatalogState.tasks = [
      createMockTask({ id: "t1", name: "Task Alpha" }),
      createMockTask({ id: "t2", name: "Task Beta" }),
    ];

    act(() => {
      root = createRoot(container);
      root.render(<DashboardViewer />);
    });

    const toolbar = container.querySelector('[data-testid="tasks-toolbar"]') as HTMLElement;
    const search = toolbar.querySelector('[data-testid="tasks-search"]') as HTMLInputElement;
    expect(search).toBeInstanceOf(HTMLInputElement);
    expect(search.getAttribute("data-im-search")).not.toBeNull();
    typeInput(search, "Alpha");

    expect(container.textContent).toContain("Task Alpha");
    expect(container.textContent).not.toContain("Task Beta");
  });

  it("filters tasks by description from the toolbar search", () => {
    taskCatalogState.tasks = [
      createMockTask({ id: "t1", name: "Task Alpha", description: "weekly digest" }),
      createMockTask({ id: "t2", name: "Task Beta", description: "hourly scan" }),
    ];

    act(() => {
      root = createRoot(container);
      root.render(<DashboardViewer />);
    });

    const toolbar = container.querySelector('[data-testid="tasks-toolbar"]') as HTMLElement;
    const search = toolbar.querySelector('[data-testid="tasks-search"]') as HTMLInputElement;
    expect(search).toBeInstanceOf(HTMLInputElement);
    typeInput(search, "digest");

    expect(container.textContent).toContain("Task Alpha");
    expect(container.textContent).not.toContain("Task Beta");
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
    const toolbar = container.querySelector('[data-testid="tasks-toolbar"]') as HTMLElement;
    expect(toolbar.querySelector('[data-testid="tasks-search"]')).toBeInstanceOf(HTMLInputElement);
    expect(container.textContent).not.toContain("新建工作集");
    expect(
      [...container.querySelectorAll('[role="tab"]')].some((tab) => tab.textContent === "工作集"),
    ).toBe(false);

    act(() => {
      (toggle as HTMLButtonElement).click();
    });

    expect(container.querySelector('[data-testid="system-tasks-section"]')).not.toBeNull();
  });

  it("opens an in-app dialog to create a workset (no window.prompt)", async () => {
    mockPathname = "/worksets";
    taskCatalogState.tasks = [];
    taskCatalogState.worksets = [
      { id: "__general__", name: "一般", isSystem: true, notifyEnabled: true, externalEnabled: true, createdAt: null, updatedAt: null },
    ];
    const promptSpy = vi.spyOn(window, "prompt").mockImplementation(() => {
      throw new Error("prompt() is not supported.");
    });

    act(() => {
      root = createRoot(container);
      root.render(<DashboardViewer />);
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
    typeInput(input, "Alpha");

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

  it("shows workset groups including builtin General, without a system-workset toggle", () => {
    mockPathname = "/worksets";
    taskCatalogState.tasks = [];
    taskCatalogState.worksets = [
      { id: "__general__", name: "一般", isSystem: true, notifyEnabled: true, externalEnabled: true, createdAt: null, updatedAt: null },
      { id: "ws-1", name: "Ops", isSystem: false, notifyEnabled: true, externalEnabled: true, createdAt: null, updatedAt: null },
    ];

    act(() => {
      root = createRoot(container);
      root.render(<DashboardViewer />);
    });

    expect(container.querySelector('[data-testid="worksets-toolbar"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="worksets-search"]')).toBeTruthy();
    expect(container.textContent).toContain("一般");
    expect(container.textContent).toContain("Ops");
    expect(container.textContent).toContain("新建工作集");
    expect(container.textContent).not.toContain("建立新任務");
    expect(container.querySelector('[data-testid="workset-card-__general__"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="workset-card-ws-1"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="toggle-system-tasks"]')).toBeNull();
    expect(container.querySelector('[data-testid="toggle-system-worksets"]')).toBeNull();
    expect(container.textContent).not.toContain("顯示系統工作集");
    expect(container.textContent).not.toContain("隱藏系統工作集");
    expect(container.querySelector('[data-testid="system-task-card-user-or-assistant"]')).toBeNull();
  });

  it("filters worksets by name from the toolbar search", () => {
    mockPathname = "/worksets";
    taskCatalogState.tasks = [];
    taskCatalogState.worksets = [
      { id: "__general__", name: "一般", isSystem: true, notifyEnabled: true, externalEnabled: true, createdAt: null, updatedAt: null },
      { id: "ws-1", name: "Ops", isSystem: false, notifyEnabled: true, externalEnabled: true, createdAt: null, updatedAt: null },
    ];

    act(() => {
      root = createRoot(container);
      root.render(<DashboardViewer />);
    });

    const search = container.querySelector('[data-testid="worksets-search"]') as HTMLInputElement;
    expect(search).not.toBeNull();
    typeInput(search, "Ops");

    expect(container.querySelector('[data-testid="workset-card-ws-1"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="workset-card-__general__"]')).toBeNull();
  });

  it("restores mode filter from localStorage", () => {
    window.localStorage.setItem(TASKS_MODE_FILTER_STORAGE_KEY, JSON.stringify("leaderboard"));
    taskCatalogState.tasks = [
      createMockTask({ id: "t1", name: "Leaderboard Task", analysisMode: "leaderboard" }),
      createMockTask({ id: "t2", name: "Intel Task", analysisMode: "intel_event" }),
    ];

    act(() => {
      root = createRoot(container);
      root.render(<DashboardViewer />);
    });

    expect(container.textContent).toContain("Leaderboard Task");
    expect(container.textContent).not.toContain("Intel Task");
  });

  it("opens project detail route when a project card is selected", () => {
    taskCatalogState.tasks = [
      createMockTask({ id: "proj-1", name: "Launch", analysisMode: "agent", outputCalendar: true }),
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

    expect(mockNavigate).toHaveBeenCalledWith("/tasks/proj-1/agent");
  });

  describe("workset catalog page", () => {
    beforeEach(() => {
      mockPathname = "/worksets";
      taskCatalogState.worksets = [
        { id: "__general__", name: "一般", isSystem: true, notifyEnabled: true, externalEnabled: true, createdAt: null, updatedAt: null },
        { id: "ws-1", name: "Ops", isSystem: false, notifyEnabled: true, externalEnabled: true, createdAt: null, updatedAt: null },
      ];
      taskCatalogState.tasks = [
        createMockTask({ id: "t1", name: "Assigned Task", worksetId: "ws-1" }),
        createMockTask({ id: "t2", name: "Unassigned Task", worksetId: "" }),
      ];
    });

    it("groups tasks by workset; omitted worksetId lands on 一般", () => {
      act(() => {
        root = createRoot(container);
        root.render(<DashboardViewer />);
      });

      expect(container.textContent).toContain("一般");
      expect(container.textContent).toContain("Ops");
      expect(container.textContent).not.toContain("未歸屬");
      expect(container.textContent).toContain("Assigned Task");
      expect(container.textContent).toContain("Unassigned Task");
      expect(container.querySelector('[data-testid="workset-card-__general__"]')).toBeTruthy();
      expect(container.querySelector('[data-testid="toggle-system-tasks"]')).toBeNull();
      expect(container.querySelector('[data-testid="toggle-system-worksets"]')).toBeNull();
      expect(container.querySelector('[data-testid="dashboard-create-workset"]')).toBeTruthy();
    });

    it("shows catalog/graph pills in the worksets toolbar without a page title", () => {
      act(() => {
        root = createRoot(container);
        root.render(<DashboardViewer />);
      });

      const toolbar = container.querySelector('[data-testid="worksets-toolbar"]');
      const tabs = toolbar?.querySelector('[data-testid="workset-catalog-tabs"]');
      expect(tabs).toBeTruthy();
      expect(tabs?.textContent).toContain("目錄");
      expect(tabs?.textContent).toContain("流程圖");
      expect(toolbar?.querySelector('[data-testid="workset-graph-filter"]')).toBeNull();
      expect(container.querySelector('[data-testid="workset-pipeline-graph"]')).toBeNull();
      expect(container.querySelector('[data-testid="dashboard-by-workset"]')).toBeTruthy();
    });

    it("hides catalog search and create workset on the graph tab", () => {
      mockSearch = "?tab=graph";
      act(() => {
        root = createRoot(container);
        root.render(<DashboardViewer />);
      });

      const toolbar = container.querySelector('[data-testid="worksets-toolbar"]');
      expect(toolbar?.querySelector('[data-testid="worksets-search"]')).toBeNull();
      expect(toolbar?.querySelector('[data-testid="dashboard-create-workset"]')).toBeNull();
      expect(toolbar?.querySelector('[data-testid="workset-catalog-tabs"]')).toBeTruthy();
      expect(toolbar?.querySelector('[data-testid="workset-graph-filter"]')).toBeTruthy();
      expect(toolbar?.querySelector('[data-testid="workset-graph-filter-value"]')).toBeTruthy();
      expect(toolbar?.querySelector('[data-testid="workset-graph-filter-all"]')).toBeNull();
      expect(
        container.querySelector('[data-testid="workset-pipeline-graph"] [data-testid="workset-graph-filter"]'),
      ).toBeNull();
      expect(container.querySelector('[data-testid="workset-pipeline-graph"]')).toBeTruthy();
      expect(container.querySelector('[data-testid="dashboard-by-workset"]')).toBeNull();
    });

    it("opens the workset workspace instead of an overlay dialog", () => {
      act(() => {
        root = createRoot(container);
        root.render(<DashboardViewer />);
      });

      const card = container.querySelector('[data-testid="workset-card-ws-1"]') as HTMLElement;
      expect(card).toBeTruthy();
      act(() => {
        card.click();
      });

      expect(mockNavigate).toHaveBeenCalledWith("/worksets/ws-1", { replace: false });
      expect(container.querySelector('[data-testid="workset-detail-dialog"]')).toBeNull();
    });

    it("shows rename/delete icon controls for named workset groups but not for 一般", () => {
      act(() => {
        root = createRoot(container);
        root.render(<DashboardViewer />);
      });

      const opsCard = container.querySelector('[data-testid="workset-card-ws-1"]');
      const generalCard = container.querySelector('[data-testid="workset-card-__general__"]');
      expect(opsCard?.querySelector('[data-testid="workset-card-rename-ws-1"]')).toBeTruthy();
      expect(opsCard?.querySelector('[data-testid="workset-card-delete-ws-1"]')).toBeTruthy();
      expect(opsCard?.textContent ?? "").not.toContain("重新命名");
      expect(opsCard?.textContent ?? "").not.toContain("刪除");
      expect(generalCard?.textContent).toContain("內建");
      expect(generalCard?.querySelector('[data-testid="workset-card-rename-__general__"]')).toBeNull();
      expect(generalCard?.querySelector('[data-testid="workset-card-delete-__general__"]')).toBeNull();
      expect(container.textContent).not.toContain("未歸屬");
    });
  });
});
