import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the REST API module that useTaskCatalogLoader depends on.
// Mocks listTasks REST client used by TaskCatalogContext.
const { mockListTasks } = vi.hoisted(() => ({
  mockListTasks: vi.fn(),
}));

vi.mock("../api/tasks", () => ({
  listTasks: mockListTasks,
  listTaskTemplatePresets: vi.fn().mockResolvedValue([]),
}));

import { TaskCatalogProvider, useTaskCatalog } from "./TaskCatalogContext";

let latestState: ReturnType<typeof useTaskCatalog> | null = null;

function Harness() {
  latestState = useTaskCatalog();
  return null;
}

function renderHarness() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <TaskCatalogProvider>
        <Harness />
      </TaskCatalogProvider>,
    );
  });
  return { container, root };
}

function cleanupHarness(root: Root, container: HTMLElement) {
  act(() => {
    root.unmount();
  });
  container.remove();
  latestState = null;
}

async function flushAsyncWork() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("TaskCatalogContext", () => {
  beforeEach(() => {
    mockListTasks.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    latestState = null;
    vi.useRealTimers();
  });

  it("retries the initial task load and recovers without staying in a silent error state", async () => {
    mockListTasks
      .mockRejectedValueOnce(new Error("temporary failure 1"))
      .mockRejectedValueOnce(new Error("temporary failure 2"))
      .mockResolvedValueOnce([
        {
          id: "task-1",
          name: "Recovered Task",
          description: null,
          promptTemplate: "prompt",
          analysisMode: "leaderboard",
          analysisTimeRange: "7d",
          version: 1,
          isActive: true,
          channelIds: [],
          createdAt: "2026-04-17T03:00:00.000Z",
          updatedAt: "2026-04-17T03:00:00.000Z",
        },
      ]);

    const { container, root } = renderHarness();
    await flushAsyncWork();

    expect(mockListTasks).toHaveBeenCalledTimes(1);
    expect(latestState?.tasksLoading).toBe(true);
    expect(latestState?.taskLoadError).toBe("temporary failure 1");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
      await Promise.resolve();
    });

    expect(mockListTasks).toHaveBeenCalledTimes(2);
    expect(latestState?.tasksLoading).toBe(true);
    expect(latestState?.taskLoadError).toBe("temporary failure 2");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
      await Promise.resolve();
    });
    await flushAsyncWork();

    expect(mockListTasks).toHaveBeenCalledTimes(3);
    expect(latestState?.tasksLoading).toBe(false);
    expect(latestState?.taskLoadError).toBeNull();
    expect(latestState?.tasks).toHaveLength(1);

    cleanupHarness(root, container);
  });

  it("retries manual refresh before surfacing the final error", async () => {
    mockListTasks
      .mockResolvedValueOnce([
        {
          id: "task-1",
          name: "Initial Task",
          description: null,
          promptTemplate: "prompt",
          analysisMode: "leaderboard",
          analysisTimeRange: "7d",
          version: 1,
          isActive: true,
          channelIds: [],
          createdAt: "2026-04-17T03:00:00.000Z",
          updatedAt: "2026-04-17T03:00:00.000Z",
        },
      ])
      .mockRejectedValueOnce(new Error("refresh failure 1"))
      .mockRejectedValueOnce(new Error("refresh failure 2"))
      .mockResolvedValueOnce([
        {
          id: "task-2",
          name: "Recovered Refresh Task",
          description: null,
          promptTemplate: "prompt",
          analysisMode: "intel_event",
          analysisTimeRange: "all",
          version: 1,
          isActive: true,
          channelIds: [],
          createdAt: "2026-04-17T04:00:00.000Z",
          updatedAt: "2026-04-17T04:00:00.000Z",
        },
      ]);

    const { container, root } = renderHarness();
    await flushAsyncWork();

    await act(async () => {
      const refreshPromise = latestState?.refreshTasks();
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(1_000);
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(2_000);
      await Promise.resolve();
      await refreshPromise;
    });
    await flushAsyncWork();

    expect(mockListTasks).toHaveBeenCalledTimes(4);
    expect(latestState?.tasksLoading).toBe(false);
    expect(latestState?.taskLoadError).toBeNull();
    expect(latestState?.tasks.map((task) => task.id)).toEqual(["task-2"]);

    cleanupHarness(root, container);
  });

  it("loads the full analysis task list without top_level_only", async () => {
    mockListTasks.mockResolvedValueOnce([
      {
        id: "proj-1",
        name: "Launch",
        description: null,
        promptTemplate: "prompt",
        analysisMode: "agent",
        analysisTimeRange: "7d",
        version: 1,
        isActive: true,
        channelIds: [],
        createdAt: "2026-04-17T03:00:00.000Z",
        updatedAt: "2026-04-17T03:00:00.000Z",
      },
      {
        id: "event-1",
        name: "Watch",
        description: null,
        promptTemplate: "prompt",
        analysisMode: "intel_event",
        analysisTimeRange: "7d",
        version: 1,
        isActive: true,
        channelIds: [],
        createdAt: "2026-04-17T03:00:00.000Z",
        updatedAt: "2026-04-17T03:00:00.000Z",
      },
    ]);

    const { container, root } = renderHarness();
    await flushAsyncWork();

    // Catalog must call listTasks() with no opts — never topLevelOnly / top_level_only.
    expect(mockListTasks).toHaveBeenCalledTimes(1);
    expect(mockListTasks).toHaveBeenCalledWith();
    expect(latestState?.tasks.map((task) => task.id)).toEqual([
      "proj-1",
      "event-1",
    ]);

    cleanupHarness(root, container);
  });
});
