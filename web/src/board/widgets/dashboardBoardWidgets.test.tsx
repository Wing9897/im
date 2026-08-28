import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MONITOR_MODE_KEY } from "../../context/MonitorModeContext";
import { MONITOR_READ_IDS_STORAGE_KEY } from "../../domain/prefs";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import { wrapBoardProviders } from "../boardTestHarness";
import { QueueBoardWidget } from "./QueueBoardWidget";
import { StatsBoardWidget } from "./StatsBoardWidget";
import { TasksBoardWidget } from "./TasksBoardWidget";
import { SystemBoardWidget } from "./SystemBoardWidget";
import {
  makeAnalysisTask,
  resetTaskCatalogState,
  taskCatalogState,
} from "../../test/context-mocks";

vi.mock("../../context/TaskCatalogContext", async () =>
  (await import("../../test/context-mocks")).taskCatalogModuleMock(),
);

vi.mock("../../context/AnalysisStatusContext", async () =>
  (await import("../../test/context-mocks")).analysisStatusModuleMock(),
);

vi.mock("../../context/CollectorStatusContext", () => ({
  useCollectorStatus: () => ({
    collectorStatus: "running",
    aiEngineStatus: "available",
    requestAiStatusRefresh: vi.fn(),
  }),
}));

vi.mock("../../api/results", () => ({
  fetchTaskAnalysisStats: vi.fn(async () => [
    {
      taskId: "task-1",
      analyzedCount: 4,
      unanalyzedCount: 2,
      queuedMessageCount: 1,
      triggerThreshold: 50,
    },
  ]),
}));

describe("dashboard-family board widgets (phase 3)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    window.localStorage.setItem(MONITOR_MODE_KEY, "canvas");
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    resetTaskCatalogState([
      makeAnalysisTask({ id: "task-1", name: "Intel task", worksetId: SYSTEM_WORKSET_ID }),
    ]);
    taskCatalogState.worksets = [
      {
        id: SYSTEM_WORKSET_ID,
        name: "General",
        isSystem: true,
        notifyEnabled: true,
        externalEnabled: true,
        emoji: "",
        description: "",
        cover: "",
        createdAt: "",
        updatedAt: "",
      },
    ];
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    window.localStorage.clear();
  });

  async function flush() {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it("TasksBoardWidget groups by workset and shows task name", async () => {
    act(() => {
      root.render(wrapBoardProviders(createElement(TasksBoardWidget)));
    });
    await flush();
    expect(container.querySelector('[data-testid="board-tasks-group-__general__"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="board-tasks-row-task-1"]')?.textContent).toMatch(
      /Intel task/,
    );
  });

  it("StatsBoardWidget shows task name instead of raw taskId", async () => {
    act(() => {
      root.render(wrapBoardProviders(createElement(StatsBoardWidget)));
    });
    await flush();
    const row = container.querySelector('[data-testid="board-stats-row-task-1"]');
    expect(row?.textContent).toMatch(/Intel task/);
    expect(row?.textContent).not.toMatch(/^task-1$/);
  });

  it("QueueBoardWidget truncates long batch error messages", async () => {
    const { analysisStatusState } = await import("../../test/context-mocks");
    const longError = "x".repeat(120);
    analysisStatusState.queueStatus = {
      pendingCount: 0,
      processingBatches: [
        {
          batchId: "b-long",
          taskId: "task-1",
          taskName: "Intel task",
          messageCount: 1,
          status: "processing",
          retryCount: 0,
          errorMessage: longError,
        },
      ],
      attentionBatches: [],
      analysisPaused: false,
    };

    act(() => {
      root.render(wrapBoardProviders(createElement(QueueBoardWidget)));
    });
    await flush();

    const errorEl = container.querySelector('[data-testid="board-queue-error-b-long"]');
    expect(errorEl?.textContent?.length ?? 0).toBeLessThan(longError.length);
    expect(errorEl?.getAttribute("title")).toBe(longError);
  });

  it("SystemBoardWidget shows app version caption", () => {
    act(() => {
      root.render(wrapBoardProviders(createElement(SystemBoardWidget)));
    });
    expect(container.querySelector('[data-testid="board-system-version"]')?.textContent).toMatch(
      /v\d/,
    );
  });
});
