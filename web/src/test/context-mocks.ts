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
 *
 * import { mockShowToast, taskCatalogState } from "../../test/context-mocks";
 * ```
 */
import { createContext, type ReactNode } from "react";
import { vi } from "vitest";
import { buildTaskNameById } from "../domain/timeline/userEvents";
import type { AnalysisTask } from "../types";

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
    analysisMode: "event",
    analysisTimeRange: "7d",
    version: 1,
    isActive: true,
    channelIds: [],
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
};

export function resetTaskCatalogState(tasks: AnalysisTask[] = []) {
  taskCatalogState.tasks = tasks;
  taskCatalogState.tasksLoading = false;
  taskCatalogState.taskLoadError = null;
  taskCatalogState.refreshTasks.mockReset();
  taskCatalogState.refreshTasks.mockResolvedValue([]);
}

/** Module-shape mock for `vi.mock("<path>/context/TaskCatalogContext", ...)`. */
export function taskCatalogModuleMock() {
  return {
    useTaskCatalog: () => taskCatalogState,
    useTaskNameById: () => buildTaskNameById(taskCatalogState.tasks),
    TaskCatalogProvider: ({ children }: { children: ReactNode }) => children,
  };
}
