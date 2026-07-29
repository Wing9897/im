/**
 * Unit tests for useMapView hook
 *
 * Tests cover:
 * - Message accumulation (dedup by ID, descending sort, cap at MAX_RUNTIME_MESSAGES)
 * - Live mode toggle (liveMode toggle updates timeWindow)
 * - Time window management (handleTimeWindowChange updates timeWindow)
 * - Fullscreen toggle (toggleFullscreen updates isFullscreen)
 * - Analysis event trigger (lastAnalysisEvent "completed" recenters live timeWindow)
 *
 * _Requirements: 9.1_
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
    activeAnalysis: null as null,
    activeAnalyses: new Map(),
    lastAnalysisEvent: null as any,
    lastAccountStatusChange: null as null,
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
    accountId: "acc-1",
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

describe("useMapView", () => {
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
  // Message accumulation (pure logic tests — no React rendering needed)
  // =========================================================================

  describe("Message accumulation", () => {
    it("deduplicates messages by ID", () => {
      const msg1 = createMessage("msg-1", "2024-01-01T10:00:00Z");
      const msg1Updated = createMessage("msg-1", "2024-01-01T11:00:00Z");
      const msg2 = createMessage("msg-2", "2024-01-01T09:00:00Z");

      // Simulate the accumulation logic (same as useMapView's useEffect)
      const prev: Message[] = [msg1, msg2];
      const incoming: Message[] = [msg1Updated];

      const nextById = new Map(prev.map((m) => [m.id, m]));
      for (const m of incoming) {
        nextById.set(m.id, m);
      }
      const result = sortMessagesDesc(Array.from(nextById.values())).slice(0, MAX_RUNTIME_MESSAGES);

      // Should have 2 messages (msg-1 updated, msg-2), not 3
      expect(result.length).toBe(2);
      const ids = result.map((m) => m.id);
      expect(new Set(ids).size).toBe(ids.length);
      // msg-1 should have the updated timestamp
      const foundMsg1 = result.find((m) => m.id === "msg-1");
      expect(foundMsg1?.timestamp).toBe("2024-01-01T11:00:00Z");
    });

    it("sorts messages in descending order by timestamp", () => {
      const messages = [
        createMessage("msg-1", "2024-01-01T08:00:00Z"),
        createMessage("msg-2", "2024-01-01T12:00:00Z"),
        createMessage("msg-3", "2024-01-01T10:00:00Z"),
      ];

      const result = sortMessagesDesc(messages);

      for (let i = 0; i < result.length - 1; i++) {
        const currentTs = new Date(result[i].timestamp).getTime();
        const nextTs = new Date(result[i + 1].timestamp).getTime();
        expect(currentTs).toBeGreaterThanOrEqual(nextTs);
      }
      expect(result[0].id).toBe("msg-2"); // 12:00 first
      expect(result[2].id).toBe("msg-1"); // 08:00 last
    });

    it("caps accumulated messages at MAX_RUNTIME_MESSAGES", () => {
      // Create more messages than the cap
      const messages: Message[] = [];
      for (let i = 0; i < MAX_RUNTIME_MESSAGES + 50; i++) {
        const ts = new Date(2024, 0, 1, 0, 0, i).toISOString();
        messages.push(createMessage(`msg-${i}`, ts));
      }

      const nextById = new Map(messages.map((m) => [m.id, m]));
      const result = sortMessagesDesc(Array.from(nextById.values())).slice(0, MAX_RUNTIME_MESSAGES);

      expect(result.length).toBe(MAX_RUNTIME_MESSAGES);
    });

    it("accumulates messages from multiple batches with dedup", () => {
      const batch1 = [
        createMessage("msg-1", "2024-01-01T10:00:00Z"),
        createMessage("msg-2", "2024-01-01T09:00:00Z"),
      ];
      const batch2 = [
        createMessage("msg-2", "2024-01-01T11:00:00Z"), // update msg-2
        createMessage("msg-3", "2024-01-01T08:00:00Z"),
      ];

      // Apply batch1
      let state: Message[] = [];
      let nextById = new Map(state.map((m) => [m.id, m]));
      for (const m of batch1) nextById.set(m.id, m);
      state = sortMessagesDesc(Array.from(nextById.values())).slice(0, MAX_RUNTIME_MESSAGES);

      // Apply batch2
      nextById = new Map(state.map((m) => [m.id, m]));
      for (const m of batch2) nextById.set(m.id, m);
      state = sortMessagesDesc(Array.from(nextById.values())).slice(0, MAX_RUNTIME_MESSAGES);

      expect(state.length).toBe(3);
      expect(state[0].id).toBe("msg-2"); // 11:00 (updated)
      expect(state[0].timestamp).toBe("2024-01-01T11:00:00Z");
      expect(state[1].id).toBe("msg-1"); // 10:00
      expect(state[2].id).toBe("msg-3"); // 08:00
    });
  });

  // =========================================================================
  // Live mode toggle (hook-level tests)
  // =========================================================================

  describe("Live mode toggle", () => {
    it("starts in live mode by default", () => {
      const { root, container } = mountHook();
      try {
        expect(latestResult!.liveMode).toBe(true);
      } finally {
        unmountHook(root, container);
      }
    });

    it("toggles liveMode off and on", () => {
      const { root, container } = mountHook();
      try {
        act(() => {
          latestResult!.handleLiveModeToggle();
        });
        expect(latestResult!.liveMode).toBe(false);

        act(() => {
          latestResult!.handleLiveModeToggle();
        });
        expect(latestResult!.liveMode).toBe(true);
      } finally {
        unmountHook(root, container);
      }
    });

    it("exitLiveMode turns live off without toggling back on", () => {
      const { root, container } = mountHook();
      try {
        expect(latestResult!.liveMode).toBe(true);
        act(() => {
          latestResult!.exitLiveMode();
        });
        expect(latestResult!.liveMode).toBe(false);
        act(() => {
          latestResult!.exitLiveMode();
        });
        expect(latestResult!.liveMode).toBe(false);
      } finally {
        unmountHook(root, container);
      }
    });

    it("updates timeWindow when toggling back to live mode", () => {
      const now = new Date("2024-06-15T12:00:00Z").getTime();
      vi.setSystemTime(now);

      const { root, container } = mountHook();
      try {
        // Toggle off
        act(() => {
          latestResult!.handleLiveModeToggle();
        });

        // Manually set a different time window
        const customWindow: TimeWindow = {
          start: new Date("2023-01-01"),
          end: new Date("2023-06-01"),
        };
        act(() => {
          latestResult!.handleTimeWindowChange(customWindow);
        });
        expect(latestResult!.timeWindow).toEqual(customWindow);

        // Toggle back to live mode — should reset timeWindow to current time ± liveWindowMs
        act(() => {
          latestResult!.handleLiveModeToggle();
        });
        expect(latestResult!.liveMode).toBe(true);

        // timeWindow should be centered around "now"
        const liveWindowMs = 12 * 3600_000; // default 12 hours
        const expectedStart = new Date(now - liveWindowMs);
        const expectedEnd = new Date(now + liveWindowMs);
        expect(latestResult!.timeWindow.start.getTime()).toBe(expectedStart.getTime());
        expect(latestResult!.timeWindow.end.getTime()).toBe(expectedEnd.getTime());
      } finally {
        unmountHook(root, container);
      }
    });
  });

  // =========================================================================
  // Time window management
  // =========================================================================

  describe("Time window management", () => {
    it("handleTimeWindowChange updates timeWindow", () => {
      const { root, container } = mountHook();
      try {
        // Turn off live mode first so manual changes persist
        act(() => {
          latestResult!.handleLiveModeToggle();
        });

        const newWindow: TimeWindow = {
          start: new Date("2024-03-01T00:00:00Z"),
          end: new Date("2024-03-31T23:59:59Z"),
        };

        act(() => {
          latestResult!.handleTimeWindowChange(newWindow);
        });

        expect(latestResult!.timeWindow).toEqual(newWindow);
      } finally {
        unmountHook(root, container);
      }
    });

    it("timeWindow reflects the live window when in live mode", () => {
      const now = new Date("2024-06-15T12:00:00Z").getTime();
      vi.setSystemTime(now);

      const { root, container } = mountHook();
      try {
        const liveWindowMs = 12 * 3600_000;
        expect(latestResult!.timeWindow.start.getTime()).toBe(now - liveWindowMs);
        expect(latestResult!.timeWindow.end.getTime()).toBe(now + liveWindowMs);
      } finally {
        unmountHook(root, container);
      }
    });
  });

  // =========================================================================
  // Fullscreen toggle
  // =========================================================================

  describe("Fullscreen toggle", () => {
    it("starts with isFullscreen as false", () => {
      const { root, container } = mountHook();
      try {
        expect(latestResult!.isFullscreen).toBe(false);
      } finally {
        unmountHook(root, container);
      }
    });

    it("updates isFullscreen when fullscreenchange event fires", () => {
      const { root, container } = mountHook();
      try {
        expect(latestResult!.isFullscreen).toBe(false);

        // Simulate entering fullscreen
        act(() => {
          Object.defineProperty(document, "fullscreenElement", {
            value: document.createElement("div"),
            writable: true,
            configurable: true,
          });
          document.dispatchEvent(new Event("fullscreenchange"));
        });

        expect(latestResult!.isFullscreen).toBe(true);

        // Simulate exiting fullscreen
        act(() => {
          Object.defineProperty(document, "fullscreenElement", {
            value: null,
            writable: true,
            configurable: true,
          });
          document.dispatchEvent(new Event("fullscreenchange"));
        });

        expect(latestResult!.isFullscreen).toBe(false);
      } finally {
        unmountHook(root, container);
      }
    });
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
        payload: { taskId: "task-1", analysisMode: "event" },
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
        payload: { taskId: "task-1", analysisMode: "event" },
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
  activeAnalysis: null,
  activeAnalyses: new Map(),
  lastAnalysisEvent: null,
  lastAccountStatusChange: null,
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
