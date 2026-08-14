/**
 * Unit tests for useMapView hook
 *
 * Tests cover:
 * - Message accumulation (dedup by ID, descending sort, cap at MAX_RUNTIME_MESSAGES)
 * - Live mode toggle (liveMode toggle updates timeWindow)
 * - Time window management (handleTimeWindowChange updates timeWindow)
 * - Fullscreen toggle (toggleFullscreen updates isFullscreen)
 * - Analysis event trigger (lastAnalysisEvent "completed" recenters live timeWindow)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement, act, memo, useState, useCallback } from "react";
import { createRoot, type Root } from "react-dom/client";
import { makeAnalysisEvent } from "../../../test/analysisEventFixtures";
import type { Message, TimeWindow } from "../../../types";
import { MAX_RUNTIME_MESSAGES, sortMessagesDesc } from "./mapViewHelpers";
import {
  AnalysisStatusProvider,
  type AnalysisStatusContextValue,
} from "../../../context/AnalysisStatusContext";
import { CollectorStatusContext } from "../../../context/CollectorStatusContext";
import type { CollectorStatusContextValue } from "../../../context/CollectorStatusContext";
import { RuntimeLogsContext } from "../../../context/runtimeLogs/RuntimeLogsContext";
import type { RuntimeLogsContextValue } from "../../../context/runtimeLogs/RuntimeLogsContext";

// --- Mocks ---

vi.mock("../../../api/messages", () => ({
  queryMessagesPage: vi.fn(async () => ({ messages: [], totalCount: 0, nextCursor: null, hasMore: false })),
}));

vi.mock("../../utils/logger", () => ({
  logWarn: vi.fn(),
}));

// Track the lastMessagesUpdate and lastAnalysisEvent values we inject via context
let mockLastMessagesUpdate: any = null;
let mockLastAnalysisEvent: any = null;

const { useRealAnalysisStatus, mockAnalysisStatusValue } = vi.hoisted(() => {
  const value = {
    queueStatus: null as null,
    analysisPaused: false,
    activeAnalyses: new Map(),
    lastAnalysisEvent: null as any,
    lastSourceStatusChange: null as null,
    lastMessagesUpdate: null as any,
    requestQueueStatusRefresh: () => {},
  };
  return {
    useRealAnalysisStatus: { current: false },
    mockAnalysisStatusValue: value,
  };
});

vi.mock("../../../context/AnalysisStatusContext", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("../../../context/AnalysisStatusContext")
  >();
  return {
    ...actual,
    useAnalysisStatus: () => {
      if (useRealAnalysisStatus.current) {
        return actual.useAnalysisStatus();
      }
      mockAnalysisStatusValue.lastAnalysisEvent = mockLastAnalysisEvent;
      mockAnalysisStatusValue.lastMessagesUpdate = mockLastMessagesUpdate;
      return mockAnalysisStatusValue;
    },
  };
});

vi.mock("../../../hooks/usePersistedState", () => ({
  usePersistedState: (_key: string, defaultValue: unknown) => {
    const react = require("react");
    return react.useState(defaultValue);
  },
}));

// Import the hook under test (after mocks)
const { useMapView } = await import("./useMapView");

// --- Helpers ---

function createMessage(id: string, timestamp: string): Message {
  return {
    id,
    sourceId: "acc-1",
    channelId: "ch-1",
    channelName: "test-channel",
    platform: "discord",
    platformMessageId: `plat-${id}`,
    senderId: "sender-1",
    senderName: "Test User",
    content: `Message ${id}`,
    timestamp,
    rawData: null,
    createdAt: timestamp,
  };
}

// --- Hook test harness using createRoot + act ---

interface HookResult {
  liveMode: boolean;
  handleLiveModeToggle: () => void;
  exitLiveMode: () => void;
  timeWindow: TimeWindow;
  handleTimeWindowChange: (w: TimeWindow) => void;
  isFullscreen: boolean;
  toggleFullscreen: () => void;
}

let latestResult: HookResult | null = null;

function HookConsumer() {
  const result = useMapView({
    items: [],
  });
  latestResult = result;
  return null;
}

function mountHook(): { root: Root; container: HTMLDivElement } {
  const container = document.createElement("div");
  document.body.appendChild(container);
  let root: Root;
  act(() => {
    root = createRoot(container);
    root.render(createElement(HookConsumer));
  });
  return { root: root!, container };
}

function unmountHook(root: Root, container: HTMLDivElement) {
  act(() => {
    root.unmount();
  });
  document.body.removeChild(container);
}

// --- Tests ---

describe("useMapView analysis", () => {
  beforeEach(() => {
    useRealAnalysisStatus.current = false;
    mockLastMessagesUpdate = null;
    mockLastAnalysisEvent = null;
    latestResult = null;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // =========================================================================
  // Analysis event trigger (SSE lastAnalysisEvent)
  // =========================================================================

  describe("Analysis event trigger", () => {
    it("recenters live timeWindow when lastAnalysisEvent is a completed event in live mode", () => {
      const now = new Date("2024-06-15T12:00:00Z").getTime();
      vi.setSystemTime(now);

      const container = document.createElement("div");
      document.body.appendChild(container);

      let root: Root;
      act(() => {
        root = createRoot(container);
        root.render(
          createElement(
            function HookConsumerWithAnalysisEvent() {
              const result = useMapView({
                items: [],
              });
              latestResult = result;
              return null;
            },
          ),
        );
      });

      const liveWindowMs = 12 * 3600_000;
      expect(latestResult!.timeWindow.start.getTime()).toBe(now - liveWindowMs);
      expect(latestResult!.timeWindow.end.getTime()).toBe(now + liveWindowMs);

      const shiftedNow = now + 60_000;
      vi.setSystemTime(shiftedNow);

      mockLastAnalysisEvent = {
        type: "completed",
        payload: { taskId: "task-1", analysisMode: "intel_event" },
      };

      act(() => {
        root.render(
          createElement(
            function HookConsumerWithAnalysisEvent() {
              const result = useMapView({
                items: [],
              });
              latestResult = result;
              return null;
            },
          ),
        );
      });

      expect(latestResult!.timeWindow.start.getTime()).toBe(shiftedNow - liveWindowMs);
      expect(latestResult!.timeWindow.end.getTime()).toBe(shiftedNow + liveWindowMs);

      act(() => { root.unmount(); });
      document.body.removeChild(container);
    });

    it("does NOT recenter timeWindow when lastAnalysisEvent type is 'started'", () => {
      const now = new Date("2024-06-15T12:00:00Z").getTime();
      vi.setSystemTime(now);

      const container = document.createElement("div");
      document.body.appendChild(container);

      let root: Root;
      act(() => {
        root = createRoot(container);
        root.render(
          createElement(
            function HookConsumerStarted() {
              const result = useMapView({
                items: [],
              });
              latestResult = result;
              return null;
            },
          ),
        );
      });

      const beforeStart = {
        start: latestResult!.timeWindow.start.getTime(),
        end: latestResult!.timeWindow.end.getTime(),
      };

      mockLastAnalysisEvent = {
        type: "started",
        payload: { taskId: "task-1" },
      };

      act(() => {
        root.render(
          createElement(
            function HookConsumerStarted() {
              const result = useMapView({
                items: [],
              });
              latestResult = result;
              return null;
            },
          ),
        );
      });

      expect(latestResult!.timeWindow.start.getTime()).toBe(beforeStart.start);
      expect(latestResult!.timeWindow.end.getTime()).toBe(beforeStart.end);

      act(() => { root.unmount(); });
      document.body.removeChild(container);
    });

    it("does NOT recenter timeWindow when liveMode is off", () => {
      const now = new Date("2024-06-15T12:00:00Z").getTime();
      vi.setSystemTime(now);

      const container = document.createElement("div");
      document.body.appendChild(container);

      function HookConsumerLiveModeOffStable() {
        const result = useMapView({
          items: [],
        });
        latestResult = result;
        return null;
      }

      let root: Root;
      act(() => {
        root = createRoot(container);
        root.render(createElement(HookConsumerLiveModeOffStable));
      });

      act(() => { latestResult!.handleLiveModeToggle(); });
      expect(latestResult!.liveMode).toBe(false);

      const beforeCompleted = {
        start: latestResult!.timeWindow.start.getTime(),
        end: latestResult!.timeWindow.end.getTime(),
      };

      mockLastAnalysisEvent = {
        type: "completed",
        payload: { taskId: "task-1", analysisMode: "intel_event" },
      };

      act(() => {
        root.render(createElement(HookConsumerLiveModeOffStable));
      });

      expect(latestResult!.timeWindow.start.getTime()).toBe(beforeCompleted.start);
      expect(latestResult!.timeWindow.end.getTime()).toBe(beforeCompleted.end);

      act(() => { root.unmount(); });
      document.body.removeChild(container);
    });
  });

  describe("selection callbacks", () => {
    it("clears map selection when handleDetailClose is called", () => {
      const item = makeAnalysisEvent({
        id: "intel-1",
        taskId: "task-1",
        batchId: "batch-1",
        title: "Title",
        body: "Content",
        sourceMessageId: "msg-1",
        sourcePlatform: "telegram",
        sourceChannelName: "Channel",
        sourceMessageTime: "2026-04-17T12:00:00.000Z",
        taskName: "Task",
        createdAt: "2026-04-17T12:00:00.000Z",
        updatedAt: "2026-04-17T12:00:00.000Z",
      });

      let selectionResult: ReturnType<typeof useMapView> | null = null;

      function SelectionConsumer() {
        selectionResult = useMapView({ items: [item] });
        return null;
      }

      const container = document.createElement("div");
      document.body.appendChild(container);
      let root: Root;
      act(() => {
        root = createRoot(container);
        root.render(createElement(SelectionConsumer));
      });

      act(() => {
        selectionResult!.handleSingleClick(item);
      });
      expect(selectionResult!.selectedItem).toEqual(item);

      act(() => {
        selectionResult!.handleDetailClose();
      });
      expect(selectionResult!.selectedItem).toBeNull();

      act(() => {
        root.unmount();
      });
      document.body.removeChild(container);
    });
  });
});

const mapViewIsolationRenderCount = { current: 0 };

const MapViewIsolationConsumer = memo(function MapViewIsolationConsumer() {
  mapViewIsolationRenderCount.current += 1;
  useMapView({ items: [] });
  return null;
});

const fixedAnalysisValue: AnalysisStatusContextValue = {
  queueStatus: null,
  analysisPaused: false,
  activeAnalyses: new Map(),
  lastAnalysisEvent: null,
  lastSourceStatusChange: null,
  lastMessagesUpdate: null,
  requestQueueStatusRefresh: () => {},
};

const fixedLogsValue: RuntimeLogsContextValue = {
  logs: [],
  totalLogCount: 0,
  hasMoreLogs: false,
  logsLoading: false,
  logsLoadingMore: false,
  logLoadError: null,
  clearLogs: () => {},
  refreshLogs: async () => {},
  loadMoreLogs: async () => {},
};

const fixedCollectorValue: CollectorStatusContextValue = {
  collectorStatus: "running",
  aiEngineStatus: "available",
  requestAiStatusRefresh: () => {},
};

type ContextUpdater = (
  newCollector: CollectorStatusContextValue,
  newLogs: RuntimeLogsContextValue,
) => void;
let harnessUpdateContexts: ContextUpdater | null = null;

function MapViewIsolationHarness() {
  const [collectorValue, setCollectorValue] = useState<CollectorStatusContextValue>(fixedCollectorValue);
  const [logsValue, setLogsValue] = useState<RuntimeLogsContextValue>(fixedLogsValue);

  harnessUpdateContexts = useCallback((newCollector: CollectorStatusContextValue, newLogs: RuntimeLogsContextValue) => {
    setCollectorValue(newCollector);
    setLogsValue(newLogs);
  }, []);

  return createElement(
    CollectorStatusContext.Provider,
    { value: collectorValue },
    createElement(
      AnalysisStatusProvider,
      { value: fixedAnalysisValue },
      createElement(
        RuntimeLogsContext.Provider,
        { value: logsValue },
        createElement(MapViewIsolationConsumer),
      ),
    ),
  );
}

describe("useMapView context isolation", () => {
  it("does NOT re-render when CollectorStatus or RuntimeLogs change while AnalysisStatus is unchanged", () => {
    useRealAnalysisStatus.current = true;
    mapViewIsolationRenderCount.current = 0;
    harnessUpdateContexts = null;

    const container = document.createElement("div");
    let root: Root | null = null;

    act(() => {
      root = createRoot(container);
      root.render(createElement(MapViewIsolationHarness));
    });

    const rendersAfterMount = mapViewIsolationRenderCount.current;
    expect(rendersAfterMount).toBeGreaterThanOrEqual(1);

    act(() => {
      harnessUpdateContexts!(
        { collectorStatus: "error", aiEngineStatus: "unavailable", requestAiStatusRefresh: () => {} },
        {
          ...fixedLogsValue,
          totalLogCount: 99,
          logs: [
            {
              id: "log-1",
              time: "2026-01-01T00:00:00.000Z",
              level: "warning",
              category: "system",
              kind: "event",
              message: "test log",
            },
          ],
        },
      );
    });

    expect(mapViewIsolationRenderCount.current).toBe(rendersAfterMount);

    act(() => root!.unmount());
  });
});
