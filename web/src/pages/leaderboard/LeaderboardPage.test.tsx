import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ensureZhHantLocale, wrapWithI18n } from "../../test/i18nHarness";

const { mockFetchTrendingTopics, mockListChannelsWithSources, runtimeState } = vi.hoisted(() => ({
  mockFetchTrendingTopics: vi.fn(),
  mockListChannelsWithSources: vi.fn(),
  runtimeState: {
    lastAnalysisEvent: null as {
      type: "completed";
      payload: {
        taskId: string;
        batchId: string;
        analysisMode: "leaderboard" | "intel_event";
        findingsCount: number;
        hasFindings: boolean;
      };
      receivedAt: number;
    } | null,
  },
}));

vi.mock("../../api/results", () => ({
  fetchTrendingTopics: (...args: unknown[]) => mockFetchTrendingTopics(...args),
  fetchTopicMessages: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../api/channels", () => ({
  listChannelsWithSources: (...args: unknown[]) => mockListChannelsWithSources(...args),
}));

vi.mock("../../context/AnalysisStatusContext", () => ({
  useAnalysisStatus: () => ({
    lastAnalysisEvent: runtimeState.lastAnalysisEvent,
    queueStatus: null,
    analysisPaused: false,
    activeAnalyses: new Map(),
    lastSourceStatusChange: null,
    lastMessagesUpdate: null,
    requestQueueStatusRefresh: () => {},
  }),
}));

vi.mock("../../context/TaskCatalogContext", async () =>
  (await import("../../test/context-mocks")).taskCatalogModuleMock());

vi.mock("react-router-dom", () => ({
  Link: ({
    children,
    to,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) =>
    createElement("a", { href: to, ...props }, children),
}));

import {
  makeAnalysisTask,
  resetTaskCatalogState,
  taskCatalogState,
} from "../../test/context-mocks";
import { LeaderboardPage } from "./LeaderboardPage";

function pageTree() {
  return wrapWithI18n(createElement(LeaderboardPage));
}

describe("LeaderboardPage", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(async () => {
    await ensureZhHantLocale();
    container = document.createElement("div");
    document.body.appendChild(container);
    window.localStorage.clear();
    mockFetchTrendingTopics.mockReset();
    mockListChannelsWithSources.mockReset();
    runtimeState.lastAnalysisEvent = null;
    mockFetchTrendingTopics.mockResolvedValue([]);
    mockListChannelsWithSources.mockResolvedValue([]);
    resetTaskCatalogState([
      makeAnalysisTask({
        name: "Leaderboard Task",
        description: null,
        analysisMode: "leaderboard",
        createdAt: "2026-04-17T03:00:00.000Z",
        updatedAt: "2026-04-17T03:00:00.000Z",
      }),
    ]);
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

  it("refetches topics only once for each completed analysis event", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(pageTree());
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockFetchTrendingTopics).toHaveBeenCalledTimes(1);

    runtimeState.lastAnalysisEvent = {
      type: "completed",
      payload: {
        taskId: "task-1",
        batchId: "batch-1",
        analysisMode: "leaderboard",
        findingsCount: 1,
        hasFindings: true,
      },
      receivedAt: 1,
    };

    await act(async () => {
      root!.render(pageTree());
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockFetchTrendingTopics).toHaveBeenCalledTimes(2);
  });

  it("ignores completed analysis events for other display types", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(pageTree());
      await Promise.resolve();
      await Promise.resolve();
    });

    mockFetchTrendingTopics.mockClear();
    runtimeState.lastAnalysisEvent = {
      type: "completed",
      payload: {
        taskId: "task-1",
        batchId: "batch-2",
        analysisMode: "intel_event",
        findingsCount: 1,
        hasFindings: true,
      },
      receivedAt: 2,
    };

    await act(async () => {
      root!.render(pageTree());
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockFetchTrendingTopics).not.toHaveBeenCalled();
  });

  describe("error retry button", () => {
    it("shows a retry button inside the error banner when fetch fails", async () => {
      mockFetchTrendingTopics.mockRejectedValue(new Error("Network error"));

      await act(async () => {
        root = createRoot(container);
        root.render(pageTree());
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(container.textContent).toContain("Network error");
      const retryButton = container.querySelector(
        'button[aria-label="重試載入"]',
      ) as HTMLButtonElement;
      expect(retryButton).not.toBeNull();
      expect(retryButton.textContent).toBe("重試");
    });

    it("re-fetches topics when the retry button is clicked", async () => {
      let callCount = 0;
      mockFetchTrendingTopics.mockImplementation(() => {
        callCount++;
        if (callCount <= 1) {
          return Promise.reject(new Error("Network error"));
        }
        return Promise.resolve([]);
      });

      await act(async () => {
        root = createRoot(container);
        root.render(pageTree());
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(container.textContent).toContain("Network error");

      const retryButton = container.querySelector(
        'button[aria-label="重試載入"]',
      ) as HTMLButtonElement;

      await act(async () => {
        retryButton.click();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(callCount).toBeGreaterThanOrEqual(2);
      expect(container.textContent).not.toContain("Network error");
    });

    it("shows loading state and disables the retry button during retry", async () => {
      let resolveRetry: (() => void) | null = null;
      let callCount = 0;

      // Use taskLoadError so the error banner persists even when fetchTopics clears its own error
      taskCatalogState.taskLoadError = "Task load failed";

      mockFetchTrendingTopics.mockImplementation(() => {
        callCount++;
        // Return a promise that we control so we can observe the in-flight state
        return new Promise<never[]>((resolve) => {
          resolveRetry = () => resolve([]);
        });
      });

      await act(async () => {
        root = createRoot(container);
        root.render(pageTree());
        await Promise.resolve();
      });

      // The error banner should be visible from taskLoadError
      expect(container.textContent).toContain("Task load failed");

      const retryButton = container.querySelector(
        'button[aria-label="重試載入"]',
      ) as HTMLButtonElement;
      expect(retryButton).not.toBeNull();
      expect(retryButton.disabled).toBe(false);

      // Resolve the initial fetch so loading completes
      await act(async () => {
        resolveRetry?.();
        await Promise.resolve();
        await Promise.resolve();
      });

      // Click retry — a new fetch starts
      act(() => {
        retryButton.click();
      });

      // Allow the state update from the click handler to flush
      await act(async () => {
        await Promise.resolve();
      });

      // While the retry is in progress, button should show loading text and be disabled
      // The banner stays because taskLoadError is still set
      const pendingButton = container.querySelector(
        'button[aria-label="重試載入"]',
      ) as HTMLButtonElement;
      expect(pendingButton).not.toBeNull();
      expect(pendingButton.textContent).toBe("重試中…");
      expect(pendingButton.disabled).toBe(true);

      // Resolve the retry fetch
      await act(async () => {
        resolveRetry?.();
        await Promise.resolve();
        await Promise.resolve();
      });

      // After retry completes, button should return to normal state
      const doneButton = container.querySelector(
        'button[aria-label="重試載入"]',
      ) as HTMLButtonElement;
      expect(doneButton).not.toBeNull();
      expect(doneButton.textContent).toBe("重試");
      expect(doneButton.disabled).toBe(false);

      // Clean up
      taskCatalogState.taskLoadError = null;
    });
  });

  describe("task filter toolbar", () => {
    it("renders the task select without a search field", async () => {
      await act(async () => {
        root = createRoot(container);
        root.render(pageTree());
        await Promise.resolve();
        await Promise.resolve();
      });

      const toolbar = container.querySelector('[data-testid="leaderboard-toolbar"]');
      expect(toolbar).not.toBeNull();
      expect(toolbar!.className).toContain("im-control-bar");

      const taskSelect = container.querySelector(
        'select[aria-label="選擇排行榜任務"]',
      ) as HTMLSelectElement;
      expect(taskSelect).not.toBeNull();
      expect(container.querySelector('input[aria-label="搜尋排行榜"]')).toBeNull();
      expect(container.querySelector('button[aria-label="搜尋排行榜"]')).toBeNull();
    });
  });

  describe("refresh UX", () => {
    it("keeps topic table visible while a background refresh is in flight", async () => {
      let resolveRefresh: ((value: unknown) => void) | null = null;
      mockFetchTrendingTopics
        .mockResolvedValueOnce([
          {
            id: "topic-1",
            taskId: "task-1",
            taskName: "Leaderboard Task",
            topicName: "地震討論",
            rank: 1,
            score: 0.9,
            summary: "regional chatter",
            createdAt: "2026-04-17T03:00:00.000Z",
            updatedAt: "2026-04-17T03:00:00.000Z",
          },
        ])
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveRefresh = resolve;
            }),
        );

      await act(async () => {
        root = createRoot(container);
        root.render(pageTree());
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(container.textContent).toContain("地震討論");

      await act(async () => {
        runtimeState.lastAnalysisEvent = {
          type: "completed",
          payload: {
            taskId: "task-1",
            batchId: "batch-refresh",
            analysisMode: "leaderboard",
            findingsCount: 1,
            hasFindings: true,
          },
          receivedAt: 3,
        };
        root!.render(pageTree());
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(container.textContent).toContain("地震討論");
      expect(container.querySelector('[role="status"][aria-label="正在更新排行榜"]')).not.toBeNull();

      await act(async () => {
        resolveRefresh?.([
          {
            id: "topic-2",
            taskId: "task-1",
            taskName: "Leaderboard Task",
            topicName: "演唱會",
            rank: 1,
            score: 0.8,
            summary: null,
            createdAt: "2026-04-17T03:00:00.000Z",
            updatedAt: "2026-04-17T03:00:00.000Z",
          },
        ]);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(container.textContent).toContain("演唱會");
      expect(container.textContent).not.toContain("地震討論");
    });
  });
});
