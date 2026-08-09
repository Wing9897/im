import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock useSSE — captures the onEvent callback so tests can fire SSE events
// ---------------------------------------------------------------------------

const { capturedOnEvent, mockFetchQueueStatus, mockCheckAiEngineStatus, mockFetchCollectorStatus } = vi.hoisted(() => ({
  capturedOnEvent: { current: null as ((event: { event: string; data: unknown }) => void) | null },
  mockFetchQueueStatus: vi.fn(),
  mockCheckAiEngineStatus: vi.fn(),
  mockFetchCollectorStatus: vi.fn(),
}));

vi.mock("../hooks/useSSE", () => ({
  useSSE: vi.fn((options: { onEvent: (event: { event: string; data: unknown }) => void }) => {
    capturedOnEvent.current = options.onEvent;
    return { status: "connected", disconnect: vi.fn(), reconnect: vi.fn() };
  }),
}));

vi.mock("../api/results", () => ({
  fetchQueueStatus: (...args: unknown[]) => mockFetchQueueStatus(...args),
}));

vi.mock("../api/system", () => ({
  checkAiEngineStatus: (...args: unknown[]) => mockCheckAiEngineStatus(...args),
  fetchCollectorStatus: (...args: unknown[]) => mockFetchCollectorStatus(...args),
}));

import type { Message, QueueStatus, CollectorStatusChangedPayload } from "../types";
import { useRuntimeMonitoring } from "./runtimeMonitoring";
import {
  acquireRuntimeInterest,
  resetRuntimeInterestForTests,
} from "./runtimeMonitoring/consumerInterest";
import { EVENT_LOG_REFRESH_DELAY_MS, type RuntimeMonitoringState } from "./runtimeMonitoring/types";

let latestState: RuntimeMonitoringState | null = null;
const addLogMock = vi.fn();
const refreshStoredLogsMock = vi.fn(async () => {});
const warnNonFatalMock = vi.fn();

function emptyQueue(overrides: Partial<QueueStatus> = {}): QueueStatus {
  return {
    pendingCount: 0,
    processingBatches: [],
    attentionBatches: [],
    analysisPaused: false,
    ...overrides,
  };
}

function sampleBatch(
  overrides: Partial<QueueStatus["processingBatches"][number]> = {},
): QueueStatus["processingBatches"][number] {
  return {
    batchId: "batch-1",
    taskId: "task-1",
    taskName: "Task 1",
    messageCount: 3,
    status: "processing",
    retryCount: 0,
    promptTokens: 0,
    completionTokens: 0,
    ...overrides,
  };
}

function HookHarness() {
  latestState = useRuntimeMonitoring({
    addLog: addLogMock,
    refreshStoredLogs: refreshStoredLogsMock,
    warnNonFatal: warnNonFatalMock,
  });
  return null;
}

function renderHarness() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<HookHarness />);
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

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flushAsyncWork() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

/** Fire an SSE event through the captured onEvent callback */
function fireSseEvent(eventName: string, data: unknown) {
  if (!capturedOnEvent.current) throw new Error("useSSE onEvent not captured — hook may not have rendered");
  capturedOnEvent.current({ event: eventName, data });
}

describe("useRuntimeMonitoring", () => {
  beforeEach(() => {
    mockFetchQueueStatus.mockReset(); mockCheckAiEngineStatus.mockReset(); mockFetchCollectorStatus.mockReset();
    capturedOnEvent.current = null;
    addLogMock.mockReset();
    refreshStoredLogsMock.mockClear();
    warnNonFatalMock.mockReset();
    resetRuntimeInterestForTests();
  });

  afterEach(() => {
    latestState = null;
    resetRuntimeInterestForTests();
    vi.useRealTimers();
  });

  it("ignores a late queue refresh result after collector stops", async () => {
    const delayedQueue = createDeferred<QueueStatus>();
    let queueCallCount = 0;

    mockFetchCollectorStatus.mockResolvedValue("running");
    mockFetchQueueStatus.mockImplementation(() => {
      queueCallCount += 1;
      if (queueCallCount === 1) {
        return Promise.resolve(emptyQueue());
      }
      return delayedQueue.promise;
    });
    mockCheckAiEngineStatus.mockResolvedValue({
      status: "available",
      reason: null,
      provider: "test",
    });

    const { container, root } = renderHarness();
    await flushAsyncWork();

    act(() => {
      latestState!.requestQueueStatusRefresh(false);
    });

    act(() => {
      fireSseEvent("collector_status_changed", { status: "stopped" });
    });

    await act(async () => {
      delayedQueue.resolve(
        emptyQueue({
          processingBatches: [
            sampleBatch({
              taskName: "Delayed task",
              messageCount: 5,
            }),
          ],
        }),
      );
      await Promise.resolve();
    });

    expect(latestState!.collectorStatus).toBe("stopped");
    // AI health is independent of collector lifecycle — keep last probe result.
    expect(latestState!.aiEngineStatus).toBe("available");

    cleanupHarness(root, container);
  });

  it("does not block collector status bootstrap on slow log loading", async () => {
    const releaseLogs = acquireRuntimeInterest("logs");
    const logRefreshDeferred = createDeferred<void>();
    refreshStoredLogsMock.mockImplementation(() => logRefreshDeferred.promise);

    mockFetchCollectorStatus.mockResolvedValue("running");
    mockFetchQueueStatus.mockResolvedValue(emptyQueue());
    mockCheckAiEngineStatus.mockResolvedValue({
      status: "available",
      reason: null,
      provider: "test",
    });

    const { container, root } = renderHarness();
    await flushAsyncWork();

    expect(refreshStoredLogsMock).toHaveBeenCalledTimes(1);
    expect(latestState!.collectorStatus).toBe("running");
    expect(latestState!.aiEngineStatus).toBe("available");

    await act(async () => {
      logRefreshDeferred.resolve();
      await Promise.resolve();
    });

    releaseLogs();
    cleanupHarness(root, container);
  });

  it("skips stored-log bootstrap and event sync without a logs consumer", async () => {
    mockFetchCollectorStatus.mockResolvedValue("running");
    mockFetchQueueStatus.mockResolvedValue(emptyQueue());
    mockCheckAiEngineStatus.mockResolvedValue({
      status: "available",
      reason: null,
      provider: "test",
    });

    const { container, root } = renderHarness();
    await flushAsyncWork();
    refreshStoredLogsMock.mockClear();

    act(() => {
      fireSseEvent("analysis_completed", {
        taskId: "task-1",
        batchId: "batch-1",
        analysisMode: "intel_event",
        findingsCount: 2,
        hasFindings: true,
      });
    });

    expect(refreshStoredLogsMock).not.toHaveBeenCalled();
    cleanupHarness(root, container);
  });

  it("exposes the latest queue status from the shared runtime state", async () => {
    mockFetchCollectorStatus.mockResolvedValue("running");
    const queue = emptyQueue({
      pendingCount: 4,
      processingBatches: [sampleBatch()],
    });
    mockFetchQueueStatus.mockResolvedValue(queue);
    mockCheckAiEngineStatus.mockResolvedValue({
      status: "available",
      reason: null,
      provider: "test",
    });

    const { container, root } = renderHarness();
    await flushAsyncWork();

    expect(latestState!.queueStatus).toEqual(queue);
    cleanupHarness(root, container);
  });

  it("refreshes stored logs when analysis events arrive", async () => {
    vi.useFakeTimers();
    const releaseLogs = acquireRuntimeInterest("logs");

    mockFetchCollectorStatus.mockResolvedValue("running");
    mockFetchQueueStatus.mockResolvedValue(emptyQueue());
    mockCheckAiEngineStatus.mockResolvedValue({
      status: "available",
      reason: null,
      provider: "test",
    });

    const { container, root } = renderHarness();
    await flushAsyncWork();
    refreshStoredLogsMock.mockClear();

    act(() => {
      fireSseEvent("analysis_completed", {
        taskId: "task-1",
        batchId: "batch-1",
        analysisMode: "intel_event",
        findingsCount: 2,
        hasFindings: true,
      });
    });

    expect(refreshStoredLogsMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(EVENT_LOG_REFRESH_DELAY_MS);
      await Promise.resolve();
    });

    expect(refreshStoredLogsMock).toHaveBeenCalledTimes(2);
    releaseLogs();
    cleanupHarness(root, container);
  });

  it("syncs persisted collector logs after status events without appending a duplicate local log", async () => {
    vi.useFakeTimers();
    const releaseLogs = acquireRuntimeInterest("logs");

    mockFetchCollectorStatus.mockResolvedValue("stopped");
    mockFetchQueueStatus.mockResolvedValue(emptyQueue());
    mockCheckAiEngineStatus.mockResolvedValue({
      status: "unknown",
      reason: null,
      provider: null,
    });

    const { container, root } = renderHarness();
    await flushAsyncWork();
    refreshStoredLogsMock.mockClear();
    addLogMock.mockClear();

    act(() => {
      fireSseEvent("collector_status_changed", { status: "error" });
    });

    expect(latestState!.collectorStatus).toBe("error");
    expect(addLogMock).not.toHaveBeenCalled();
    expect(refreshStoredLogsMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(EVENT_LOG_REFRESH_DELAY_MS);
      await Promise.resolve();
    });

    expect(refreshStoredLogsMock).toHaveBeenCalledTimes(2);
    releaseLogs();
    cleanupHarness(root, container);
  });

  it("clears the shared queue processing batch when collector stops", async () => {
    mockFetchCollectorStatus.mockResolvedValue("running");
    mockFetchQueueStatus.mockResolvedValue(
      emptyQueue({
        pendingCount: 2,
        processingBatches: [sampleBatch()],
      }),
    );
    mockCheckAiEngineStatus.mockResolvedValue({
      status: "available",
      reason: null,
      provider: "test",
    });

    const { container, root } = renderHarness();
    await flushAsyncWork();

    act(() => {
      fireSseEvent("collector_status_changed", { status: "stopped" });
    });

    expect(latestState!.queueStatus).toEqual({
      pendingCount: 2,
      processingBatches: [],
      attentionBatches: [],
      analysisPaused: false,
    });
    cleanupHarness(root, container);
  });

  it("captures the latest analysis event from the shared runtime listener", async () => {
    mockFetchCollectorStatus.mockResolvedValue("running");
    mockFetchQueueStatus.mockResolvedValue(emptyQueue());
    mockCheckAiEngineStatus.mockResolvedValue({
      status: "available",
      reason: null,
      provider: "test",
    });

    const { container, root } = renderHarness();
    await flushAsyncWork();

    act(() => {
      fireSseEvent("analysis_started", {
        taskId: "task-1",
        taskName: "Task 1",
        batchId: "batch-1",
        messageCount: 3,
      });
    });

    expect(latestState!.lastAnalysisEvent?.type).toBe("started");
    expect(latestState!.lastAnalysisEvent?.payload.batchId).toBe("batch-1");
    cleanupHarness(root, container);
  });

  it("captures the latest source status change from the shared runtime listener", async () => {
    mockFetchCollectorStatus.mockResolvedValue("running");
    mockFetchQueueStatus.mockResolvedValue(emptyQueue());
    mockCheckAiEngineStatus.mockResolvedValue({
      status: "available",
      reason: null,
      provider: "test",
    });

    const { container, root } = renderHarness();
    await flushAsyncWork();

    act(() => {
      fireSseEvent("source_status_changed", {
        sourceId: "acct-1",
        status: "connected",
      });
    });

    await flushAsyncWork();

    expect(latestState!.lastSourceStatusChange).toEqual({
      sourceId: "acct-1",
      status: "connected",
    });
    expect(mockFetchCollectorStatus.mock.calls.length).toBeGreaterThan(1);
    expect(latestState!.collectorStatus).toBe("running");
    cleanupHarness(root, container);
  });

  it("refetches aggregate collector status on adapter wire SSE events", async () => {
    mockFetchCollectorStatus.mockResolvedValue("running");
    mockFetchQueueStatus.mockResolvedValue(emptyQueue());
    mockCheckAiEngineStatus.mockResolvedValue({
      status: "available",
      reason: null,
      provider: "test",
    });

    const { container, root } = renderHarness();
    await flushAsyncWork();

    const callsBefore = mockFetchCollectorStatus.mock.calls.length;
    act(() => {
      fireSseEvent("collector_status_changed", { status: "connected" });
    });
    await flushAsyncWork();

    expect(mockFetchCollectorStatus.mock.calls.length).toBeGreaterThan(callsBefore);
    expect(latestState!.collectorStatus).toBe("running");
    cleanupHarness(root, container);
  });

  it("captures the latest messages update from the shared runtime listener", async () => {
    vi.useFakeTimers();
    const releaseLogs = acquireRuntimeInterest("logs");

    mockFetchCollectorStatus.mockResolvedValue("running");
    mockFetchQueueStatus.mockResolvedValue(emptyQueue());
    mockCheckAiEngineStatus.mockResolvedValue({
      status: "available",
      reason: null,
      provider: "test",
    });

    const message: Message = {
      id: "message-1",
      sourceId: "acct-1",
      channelId: "channel-1",
      channelName: "Channel 1",
      platform: "telegram",
      platformMessageId: "platform-message-1",
      senderId: "sender-1",
      senderName: "Sender 1",
      content: "hello world",
      timestamp: "2026-04-17T03:00:00.000Z",
      rawData: null,
      createdAt: "2026-04-17T03:00:00.000Z",
    };

    const { container, root } = renderHarness();
    await flushAsyncWork();
    refreshStoredLogsMock.mockClear();

    act(() => {
      fireSseEvent("messages_updated", { messages: [message] });
    });

    expect(latestState!.lastMessagesUpdate).toEqual({
      payload: {
        messages: [message],
      },
      receivedAt: expect.any(Number),
    });
    expect(refreshStoredLogsMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(EVENT_LOG_REFRESH_DELAY_MS);
      await Promise.resolve();
    });

    expect(refreshStoredLogsMock).toHaveBeenCalledTimes(2);
    releaseLogs();
    cleanupHarness(root, container);
  });

  it("establishes SSE connection on mount and captures the event callback", async () => {
    mockFetchCollectorStatus.mockResolvedValue("running");
    mockFetchQueueStatus.mockResolvedValue(emptyQueue());
    mockCheckAiEngineStatus.mockResolvedValue({
      status: "available",
      reason: null,
      provider: "test",
    });

    const { container, root } = renderHarness();
    await flushAsyncWork();

    // The useSSE hook should have been called and the onEvent callback captured
    expect(capturedOnEvent.current).not.toBeNull();

    cleanupHarness(root, container);
  });

  it("does not update state after unmount (no React warnings)", async () => {
    mockFetchCollectorStatus.mockResolvedValue("running");
    mockFetchQueueStatus.mockResolvedValue(emptyQueue());
    mockCheckAiEngineStatus.mockResolvedValue({
      status: "available",
      reason: null,
      provider: "test",
    });

    // Spy on console.error to detect React "state update on unmounted" warnings
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const { container, root } = renderHarness();
    await flushAsyncWork();

    // Capture the SSE callback before unmount
    const onEvent = capturedOnEvent.current;
    expect(onEvent).not.toBeNull();

    // Unmount
    cleanupHarness(root, container);
    await flushAsyncWork();

    // Fire events after unmount — these should be no-ops due to the monitorRef guard.
    onEvent!({ event: "collector_status_changed", data: { status: "stopped" } satisfies CollectorStatusChangedPayload });
    onEvent!({ event: "analysis_started", data: {
      taskId: "t1",
      taskName: "Test Task",
      batchId: "b1",
      messageCount: 10,
    }});
    onEvent!({ event: "source_status_changed", data: { sourceId: "a1", status: "connected" } });
    onEvent!({ event: "messages_updated", data: { messages: [] } });
    onEvent!({ event: "analysis_completed", data: {
      taskId: "t1",
      batchId: "b1",
      analysisMode: "leaderboard",
      findingsCount: 5,
      hasFindings: true,
    }});
    onEvent!({ event: "analysis_failed", data: {
      taskId: "t1",
      taskName: "Test Task",
      batchId: "b2",
      error: "test error",
      retrying: false,
      currentRetry: 0,
      maxRetries: 3,
    }});

    await flushAsyncWork();

    // Check that no React "state update on unmounted component" warnings appeared
    const reactWarnings = consoleErrorSpy.mock.calls.filter(
      (args) =>
        typeof args[0] === "string" &&
        (args[0].includes("unmounted") ||
          args[0].includes("Cannot update") ||
          args[0].includes("state update")),
    );
    expect(reactWarnings).toHaveLength(0);

    consoleErrorSpy.mockRestore();
  });
});
