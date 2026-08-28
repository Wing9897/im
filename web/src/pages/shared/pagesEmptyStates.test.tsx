/**
 * Empty state rendering tests for all list components.
 *
 *
 * Verifies that each list page renders an appropriate empty state UI
 * without throwing errors when receiving empty arrays from API data.
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* ================================================================== */
/*  Shared mock setup                                                  */
/* ================================================================== */

const { mockListSources, mockQueryMessagesPage, mockFetchTrendingTopics, mockListChannelsWithSources, mockFetchEvents, mockFetchTaskAnalysisStats, runtimeState } = vi.hoisted(() => ({
  mockListSources: vi.fn(),
  mockQueryMessagesPage: vi.fn(),
  mockFetchTrendingTopics: vi.fn(),
  mockListChannelsWithSources: vi.fn(),
  mockFetchEvents: vi.fn(),
  mockFetchTaskAnalysisStats: vi.fn(),
  runtimeState: {
    lastMessagesUpdate: null as null,
    lastAnalysisEvent: null as null,
    queueStatus: {
      pendingCount: 0,
      processingBatches: [],
      analysisPaused: false,
    },
    requestAiStatusRefresh: vi.fn(),
    requestQueueStatusRefresh: vi.fn(),
  },
}));

vi.mock("../../api/sources", () => ({
  listSources: (...args: unknown[]) => mockListSources(...args),
}));

vi.mock("../../api/messages", () => ({
  queryMessagesPage: (...args: unknown[]) => mockQueryMessagesPage(...args),
}));

vi.mock("../../api/channels", () => ({
  listChannelsWithSources: (...args: unknown[]) => mockListChannelsWithSources(...args),
}));

vi.mock("../../api/results", () => ({
  fetchTrendingTopics: (...args: unknown[]) => mockFetchTrendingTopics(...args),
  fetchEvents: (...args: unknown[]) => mockFetchEvents(...args),
  fetchTaskAnalysisStats: (...args: unknown[]) => mockFetchTaskAnalysisStats(...args),
  fetchTopicMessages: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../context/CollectorStatusContext", () => ({
  useCollectorStatus: () => ({
    collectorStatus: "stopped",
    aiEngineStatus: "unknown",
    requestAiStatusRefresh: runtimeState.requestAiStatusRefresh,
  }),
}));

vi.mock("../../context/AnalysisStatusContext", () => ({
  useAnalysisStatus: () => ({
    lastAnalysisEvent: runtimeState.lastAnalysisEvent,
    lastMessagesUpdate: runtimeState.lastMessagesUpdate,
    queueStatus: runtimeState.queueStatus,
    analysisPaused: false,
    activeAnalyses: new Map(),
    lastSourceStatusChange: null,
    requestQueueStatusRefresh: runtimeState.requestQueueStatusRefresh,
  }),
}));

vi.mock("../../context/TaskCatalogContext", async () =>
  (await import("../../test/context-mocks")).taskCatalogModuleMock());

vi.mock("../../context/ToastContext", async () =>
  (await import("../../test/context-mocks")).toastContextModuleMock());

vi.mock("react-router-dom", () => ({
  Link: ({
    children,
    to,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) =>
    createElement("a", { href: to, ...props }, children),
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: "/monitor", search: "", state: null }),
  MemoryRouter: ({ children }: { children: React.ReactNode }) => children,
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}));

vi.mock("../../hooks/useRefreshOnAnalysisEvent", () => ({
  useRefreshOnAnalysisEvent: vi.fn(),
}));

vi.mock("../../hooks/useTaskAnalysisStats", async () =>
  (await import("../../test/task-analysis-stats-mock")).taskAnalysisStatsModuleMock());

vi.mock("../../api/tasks", () => ({
  deleteTask: vi.fn().mockResolvedValue(undefined),
  toggleTaskActive: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../monitor/filter/FilterBar", () => ({
  FilterBar: () => null,
  FilterActiveChips: () => null,
}));

vi.mock("../../components/common/MessageCard", () => ({
  MessageCard: () => null,
}));

vi.mock("../monitor/message/MessageListItem", () => ({
  MessageListItem: () => null,
}));

vi.mock("../intelligence/map/MapView", () => ({
  MapView: () => null,
}));

vi.mock("../../components/dialogs/DeleteConfirmDialog", () => ({
  DeleteConfirmDialog: () => null,
}));

vi.mock("../../components/common/LoadingSpinner", () => ({
  LoadingSpinner: () => null,
}));



vi.mock("../../hooks/useFocusTrap", () => ({
  useFocusTrap: () => ({ current: null }),
}));

vi.mock("../../hooks/usePipelineReadiness", () => ({
  usePipelineReadiness: () => ({
    state: "complete",
    showChecklist: false,
    loading: false,
  }),
}));

import {
  makeAnalysisTask,
  resetTaskCatalogState,
  taskCatalogState,
} from "../../test/context-mocks";

/* ================================================================== */
/*  IntersectionObserver mock                                          */
/* ================================================================== */

class MockIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "";
  readonly thresholds: number[] = [];
  readonly disconnect = vi.fn();
  readonly observe = vi.fn();
  readonly takeRecords = vi.fn(() => []);
  readonly unobserve = vi.fn();
  constructor(_callback: IntersectionObserverCallback) {}
}

/* ================================================================== */
/*  Tests                                                              */
/* ================================================================== */

describe("Empty state rendering for list components", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    window.localStorage.clear();
    mockListSources.mockReset();
    mockQueryMessagesPage.mockReset();
    mockFetchTrendingTopics.mockReset();
    mockListChannelsWithSources.mockReset();
    mockFetchEvents.mockReset();
    mockFetchTaskAnalysisStats.mockReset();
    runtimeState.lastMessagesUpdate = null;
    runtimeState.lastAnalysisEvent = null;
    resetTaskCatalogState();
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root!.unmount();
      });
    }
    root = null;
    container.remove();
    vi.unstubAllGlobals();
  });

  describe("MonitorPage — empty messages", () => {
    it("renders empty state without errors when messages array is empty", async () => {
      mockListSources.mockResolvedValue([]);
      mockListChannelsWithSources.mockResolvedValue([]);
      mockQueryMessagesPage.mockResolvedValue({
        messages: [],
        nextCursor: null,
        hasMore: false,
        totalCount: 0,
      });

      const { MonitorPage } = await import("../monitor/MonitorPage");

      await act(async () => {
        root = createRoot(container);
        root.render(createElement(MonitorPage));
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      // Should show empty state message (no sources scenario)
      expect(container.textContent).toContain("尚未開始接收實時訊息");
      // Should not throw — page renders successfully
      expect(container.querySelector('[role="status"]')).not.toBeNull();
    });

    it("renders empty state with active filters when no messages match", async () => {
      window.localStorage.setItem(
        "im:monitor:filters",
        JSON.stringify({ search: "找不到的關鍵字" }),
      );

      mockListSources.mockResolvedValue([
        {
          id: "source-1",
          platform: "telegram",
          name: "Source 1",
          status: "connected",
          createdAt: "2026-04-17T03:00:00.000Z",
          updatedAt: "2026-04-17T03:00:00.000Z",
        },
      ]);
      mockListChannelsWithSources.mockResolvedValue([]);
      mockQueryMessagesPage.mockResolvedValue({
        messages: [],
        nextCursor: null,
        hasMore: false,
        totalCount: 0,
      });

      const { MonitorPage } = await import("../monitor/MonitorPage");

      await act(async () => {
        root = createRoot(container);
        root.render(createElement(MonitorPage));
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      // Should show the filtered empty state
      expect(container.textContent).toContain("目前沒有符合條件的訊息");
      expect(container.querySelector('[role="status"]')).not.toBeNull();
    });
  });

  describe("LeaderboardPage — empty topics", () => {
    it("renders empty state without errors when topics array is empty", async () => {
      mockFetchTrendingTopics.mockResolvedValue([]);
      mockListChannelsWithSources.mockResolvedValue([]);

      const { LeaderboardPage } = await import("../leaderboard/LeaderboardPage");

      await act(async () => {
        root = createRoot(container);
        root.render(createElement(LeaderboardPage));
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      // Should show empty state for no leaderboard tasks
      expect(container.textContent).toContain("尚未建立排行榜任務");
      expect(container.querySelector('[role="status"]')).not.toBeNull();
    });

    it("renders empty state when leaderboard tasks exist but no results yet", async () => {
      taskCatalogState.tasks = [
        makeAnalysisTask({
          name: "Leaderboard Task",
          description: null,
          analysisMode: "leaderboard",
        }),
      ];

      mockFetchTrendingTopics.mockResolvedValue([]);
      mockListChannelsWithSources.mockResolvedValue([]);

      const { LeaderboardPage } = await import("../leaderboard/LeaderboardPage");

      await act(async () => {
        root = createRoot(container);
        root.render(createElement(LeaderboardPage));
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      // Should show empty state for no results
      expect(container.textContent).toContain("目前還沒有排行榜結果");
      expect(container.querySelector('[role="status"]')).not.toBeNull();
    });
  });

  describe("IntelligencePage — empty items", () => {
    it("renders empty state without errors when items array is empty", async () => {
      // Set view mode to "card" so the empty state renders (map mode shows MapView instead)
      window.localStorage.setItem(
        "im:view-mode:intelligence",
        JSON.stringify("card"),
      );

      mockFetchEvents.mockResolvedValue({ items: [], totalCount: 0, hasMore: false });
      mockListSources.mockResolvedValue([]);

      const { IntelligencePage } = await import("../intelligence/IntelligencePage");

      await act(async () => {
        root = createRoot(container);
        root.render(createElement(IntelligencePage));
        // Allow multiple microtask ticks for useAsyncResource to resolve
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      // Should show empty state for no intelligence tasks
      expect(container.textContent).toContain("尚未建立情報任務");
      expect(container.querySelector('[role="status"]')).not.toBeNull();
    });

    it("renders empty state when tasks exist but no items yet", async () => {
      // Set view mode to "card" so the empty state renders (map mode shows MapView instead)
      window.localStorage.setItem(
        "im:view-mode:intelligence",
        JSON.stringify("card"),
      );

      taskCatalogState.tasks = [
        makeAnalysisTask({ name: "Intelligence Task", description: null }),
      ];

      mockFetchEvents.mockResolvedValue({ items: [], totalCount: 0, hasMore: false });
      mockListSources.mockResolvedValue([]);

      const { IntelligencePage } = await import("../intelligence/IntelligencePage");

      await act(async () => {
        root = createRoot(container);
        root.render(createElement(IntelligencePage));
        // Allow multiple microtask ticks for useAsyncResource to resolve
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      // Should show empty state for no results
      expect(container.textContent).toContain("目前還沒有情報");
      expect(container.textContent).not.toContain("開始情報管線");
      expect(container.querySelector('[role="status"]')).not.toBeNull();
    });
  });
});
