/**
 * Shared context mocks for tests.
 *
 * Because `vi.mock` factories are hoisted, reference these helpers via a
 * dynamic import inside the factory, then import the same singletons normally
 * for assertions / per-test mutation (the module registry caches per file):
 *
 * ```ts
 * vi.mock("../../context/ToastContext", async () =>
 *   (await import("../../test/context-mocks")).toastContextModuleMock());
 * vi.mock("../../context/TaskCatalogContext", async () =>
 *   (await import("../../test/context-mocks")).taskCatalogModuleMock());
 * vi.mock("../../context/AnalysisStatusContext", async () =>
 *   (await import("../../test/context-mocks")).analysisStatusModuleMock());
 *
 * import { mockShowToast, taskCatalogState } from "../../test/context-mocks";
 * ```
 *
 * Board tests: also wrap with `wrapBoardProviders` from `../board/boardTestHarness`.
 */
import { createContext, type ReactNode } from "react";
import { vi } from "vitest";
import { buildTaskNameById } from "../domain/timeline/userEvents";
import type { AnalysisTask, Workset } from "../types";

// ── ToastContext ────────────────────────────────────────────────────────

/** Shared showToast spy; call `mockShowToast.mockReset()` in beforeEach. */
export const mockShowToast = vi.fn();

/** Module-shape mock for `vi.mock("<path>/context/ToastContext", ...)`. */
export function toastContextModuleMock() {
  return {
    ToastContext: createContext({ showToast: mockShowToast }),
    useToast: () => ({ showToast: mockShowToast }),
    ToastProvider: ({ children }: { children: ReactNode }) => children,
  };
}

// ── TaskCatalogContext ──────────────────────────────────────────────────

/** Standard AnalysisTask fixture. */
export function makeAnalysisTask(overrides: Partial<AnalysisTask> = {}): AnalysisTask {
  return {
    id: "task-1",
    name: "Task 1",
    description: "Task 1",
    promptTemplate: "prompt",
    webSearchQuery: "",
    analysisMode: "intel_event",
    analysisTimeRange: "7d",
    version: 1,
    isActive: true,
    scheduleRrule: "FREQ=SECONDLY;INTERVAL=10",
    channelIds: [],
    worksetId: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

/**
 * Mutable catalog value returned by the mocked `useTaskCatalog()`.
 * Mutate fields per test and call `resetTaskCatalogState()` in beforeEach.
 */
export const taskCatalogState = {
  tasks: [] as AnalysisTask[],
  tasksLoading: false,
  taskLoadError: null as string | null,
  refreshTasks: vi.fn(() => Promise.resolve([] as AnalysisTask[])),
  worksets: [] as Array<{ id: string; name: string; createdAt: string | null; updatedAt: string | null }>,
  worksetsLoading: false,
  refreshWorksets: vi.fn(() => Promise.resolve([] as Array<{ id: string; name: string; createdAt: string | null; updatedAt: string | null }>)),
};

export function resetTaskCatalogState(tasks: AnalysisTask[] = []) {
  taskCatalogState.tasks = tasks;
  taskCatalogState.tasksLoading = false;
  taskCatalogState.taskLoadError = null;
  taskCatalogState.refreshTasks.mockReset();
  taskCatalogState.refreshTasks.mockResolvedValue([]);
  taskCatalogState.worksets = [];
  taskCatalogState.worksetsLoading = false;
  taskCatalogState.refreshWorksets.mockReset();
  taskCatalogState.refreshWorksets.mockResolvedValue([]);
}

/** Module-shape mock for `vi.mock("<path>/context/TaskCatalogContext", ...)`. */
export function taskCatalogModuleMock() {
  return {
    useTaskCatalog: () => taskCatalogState,
    useTaskNameById: () => buildTaskNameById(taskCatalogState.tasks),
    useWorksetNameById: () => {
      const map = new Map<string, string>();
      for (const ws of taskCatalogState.worksets) map.set(ws.id, ws.name);
      return map;
    },
    TaskCatalogProvider: ({ children }: { children: ReactNode }) => children,
  };
}

// ── AnalysisStatusContext ───────────────────────────────────────────────

/**
 * Mutable analysis-status value returned by the mocked `useAnalysisStatus()`.
 * Prefer this over hand-rolled empty stubs so board tests never omit the mock.
 */
export const analysisStatusState = {
  queueStatus: {
    pendingCount: 0,
    processingBatches: [] as unknown[],
    attentionBatches: [] as unknown[],
    analysisPaused: false,
  },
  analysisPaused: false,
  activeAnalyses: new Map<string, unknown>(),
  lastAnalysisEvent: null as null,
  lastSourceStatusChange: null as null,
  lastMessagesUpdate: null as null,
  requestQueueStatusRefresh: vi.fn(),
};

export function resetAnalysisStatusState() {
  analysisStatusState.queueStatus = {
    pendingCount: 0,
    processingBatches: [],
    attentionBatches: [],
    analysisPaused: false,
  };
  analysisStatusState.analysisPaused = false;
  analysisStatusState.activeAnalyses = new Map();
  analysisStatusState.lastAnalysisEvent = null;
  analysisStatusState.lastSourceStatusChange = null;
  analysisStatusState.lastMessagesUpdate = null;
  analysisStatusState.requestQueueStatusRefresh.mockReset();
}

/** Module-shape mock for `vi.mock("<path>/context/AnalysisStatusContext", ...)`. */
export function analysisStatusModuleMock() {
  return {
    AnalysisStatusProvider: ({ children }: { children: ReactNode }) => children,
    useAnalysisStatus: () => analysisStatusState,
  };
}
