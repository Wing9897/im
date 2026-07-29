import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildUnhandledRejectionLog } from "../context/runtimeMonitoring/types";
import type { RuntimeAnalysisEvent } from "../context/runtimeMonitoring";
import {
  AnalysisStatusProvider,
  type AnalysisStatusContextValue,
} from "../context/AnalysisStatusContext";
import {
  CollectorStatusProvider,
  type CollectorStatusProviderProps,
} from "../context/CollectorStatusContext";
import { RuntimeLogsContext } from "../context/runtimeLogs/RuntimeLogsContext";
import type { RuntimeLogsContextValue } from "../context/runtimeLogs/RuntimeLogsContext";
import {
  shouldRefreshForEvent,
  useRefreshOnAnalysisEvent,
  type UseRefreshOnAnalysisEventOptions,
} from "./useRefreshOnAnalysisEvent";

const { runtimeState, analysisStatusMode } = vi.hoisted(() => ({
  runtimeState: {
    lastAnalysisEvent: null as RuntimeAnalysisEvent | null,
  },
  analysisStatusMode: { current: "mock" as "mock" | "real" },
}));

vi.mock("../context/AnalysisStatusContext", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("../context/AnalysisStatusContext")
  >();
  return {
    ...actual,
    useAnalysisStatus: () => {
      if (analysisStatusMode.current === "real") {
        return actual.useAnalysisStatus();
      }
      return runtimeState;
    },
  };
});

function Harness({
  onRefresh,
  options,
}: {
  onRefresh: () => void;
  options?: Parameters<typeof useRefreshOnAnalysisEvent>[1];
}) {
  useRefreshOnAnalysisEvent(onRefresh, options);
  return null;
}

function renderHarness(ui: React.ReactNode) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(ui);
  });
  return { container, root };
}

function cleanupHarness(root: Root, container: HTMLElement) {
  act(() => {
    root.unmount();
  });
  container.remove();
}

async function rerenderHarness(root: Root, ui: React.ReactNode) {
  await act(async () => {
    root.render(ui);
    await Promise.resolve();
  });
}

describe("useRefreshOnAnalysisEvent", () => {
  beforeEach(() => {
    analysisStatusMode.current = "mock";
    runtimeState.lastAnalysisEvent = null;
  });

  afterEach(() => {
    runtimeState.lastAnalysisEvent = null;
  });

  it("refreshes only for completed events by default", async () => {
    const onRefresh = vi.fn();
    const { container, root } = renderHarness(
      <Harness onRefresh={onRefresh} />,
    );

    runtimeState.lastAnalysisEvent = {
      type: "started",
      payload: {
        taskId: "task-1",
        taskName: "Task 1",
        batchId: "batch-1",
        messageCount: 10,
        estimatedTokens: 1000,
        llmProvider: "gemini_compatible",
        llmModel: "gemma-4-26b-a4b-it",
      },
      receivedAt: 1,
    };
    await rerenderHarness(root, <Harness onRefresh={onRefresh} />);
    expect(onRefresh).not.toHaveBeenCalled();

    runtimeState.lastAnalysisEvent = {
      type: "completed",
      payload: {
        taskId: "task-1",
        batchId: "batch-1",
        analysisMode: "leaderboard",
        findingsCount: 2,
        hasFindings: true,
        overlapStatistics: null,
      },
      receivedAt: 2,
    };
    await rerenderHarness(root, <Harness onRefresh={onRefresh} />);
    expect(onRefresh).toHaveBeenCalledTimes(1);

    cleanupHarness(root, container);
  });

  it("supports task and display type filtering", async () => {
    const onRefresh = vi.fn();
    const options = { taskId: "task-1", analysisMode: "event" as const };
    const { container, root } = renderHarness(
      <Harness onRefresh={onRefresh} options={options} />,
    );

    runtimeState.lastAnalysisEvent = {
      type: "completed",
      payload: {
        taskId: "task-1",
        batchId: "batch-1",
        analysisMode: "leaderboard",
        findingsCount: 1,
        hasFindings: true,
        overlapStatistics: null,
      },
      receivedAt: 1,
    };
    await rerenderHarness(
      root,
      <Harness onRefresh={onRefresh} options={options} />,
    );
    expect(onRefresh).not.toHaveBeenCalled();

    runtimeState.lastAnalysisEvent = {
      type: "completed",
      payload: {
        taskId: "task-2",
        batchId: "batch-2",
        analysisMode: "event",
        findingsCount: 1,
        hasFindings: true,
        overlapStatistics: null,
      },
      receivedAt: 2,
    };
    await rerenderHarness(
      root,
      <Harness onRefresh={onRefresh} options={options} />,
    );
    expect(onRefresh).not.toHaveBeenCalled();

    runtimeState.lastAnalysisEvent = {
      type: "completed",
      payload: {
        taskId: "task-1",
        batchId: "batch-3",
        analysisMode: "event",
        findingsCount: 1,
        hasFindings: true,
        overlapStatistics: null,
      },
      receivedAt: 3,
    };
    await rerenderHarness(
      root,
      <Harness onRefresh={onRefresh} options={options} />,
    );
    expect(onRefresh).toHaveBeenCalledTimes(1);

    cleanupHarness(root, container);
  });

  it("can opt into started and failed events", async () => {
    const onRefresh = vi.fn();
    const options = {
      includeStarted: true,
      includeCompleted: true,
      includeFailed: true,
    };
    const { container, root } = renderHarness(
      <Harness onRefresh={onRefresh} options={options} />,
    );

    runtimeState.lastAnalysisEvent = {
      type: "started",
      payload: {
        taskId: "task-1",
        taskName: "Task 1",
        batchId: "batch-1",
        messageCount: 5,
        estimatedTokens: 500,
        llmProvider: "gemini_compatible",
        llmModel: "gemma-4-26b-a4b-it",
      },
      receivedAt: 1,
    };
    await rerenderHarness(
      root,
      <Harness onRefresh={onRefresh} options={options} />,
    );

    runtimeState.lastAnalysisEvent = {
      type: "failed",
      payload: {
        taskId: "task-1",
        taskName: "Task 1",
        batchId: "batch-1",
        error: "boom",
        retrying: false,
        currentRetry: 1,
        maxRetries: 3,
      },
      receivedAt: 2,
    };
    await rerenderHarness(
      root,
      <Harness onRefresh={onRefresh} options={options} />,
    );

    expect(onRefresh).toHaveBeenCalledTimes(2);

    cleanupHarness(root, container);
  });
});

// ---------------------------------------------------------------------------
// shouldRefreshForEvent filtering logic
// ---------------------------------------------------------------------------

describe("shouldRefreshForEvent", () => {
  const startedEvent = {
    type: "started" as const,
    payload: {
      taskId: "task-a",
      taskName: "Task A",
      batchId: "batch-a",
      messageCount: 5,
      estimatedTokens: 500,
      llmProvider: "openai",
      llmModel: "gpt-4",
    },
    receivedAt: 1,
  };

  const completedEvent = {
    type: "completed" as const,
    payload: {
      taskId: "task-a",
      batchId: "batch-a",
      analysisMode: "leaderboard",
      findingsCount: 2,
      hasFindings: true,
      overlapStatistics: null,
    },
    receivedAt: 2,
  };

  const failedEvent = {
    type: "failed" as const,
    payload: {
      taskId: "task-a",
      taskName: "Task A",
      batchId: "batch-a",
      error: "LLM_ERROR",
      retrying: false,
      currentRetry: 0,
      maxRetries: 3,
    },
    receivedAt: 3,
  };

  it("returns false when taskId filter does not match", () => {
    const options: UseRefreshOnAnalysisEventOptions = {
      includeCompleted: true,
      taskId: "other-task",
    };
    expect(shouldRefreshForEvent(completedEvent, options)).toBe(false);
  });

  it("filters by taskIds multi-select (wins over taskId)", () => {
    expect(
      shouldRefreshForEvent(completedEvent, {
        includeCompleted: true,
        taskIds: null,
      }),
    ).toBe(true);
    expect(
      shouldRefreshForEvent(completedEvent, {
        includeCompleted: true,
        taskIds: [],
      }),
    ).toBe(false);
    expect(
      shouldRefreshForEvent(completedEvent, {
        includeCompleted: true,
        taskIds: ["task-a", "other"],
      }),
    ).toBe(true);
    expect(
      shouldRefreshForEvent(completedEvent, {
        includeCompleted: true,
        taskIds: ["other"],
        taskId: "task-a",
      }),
    ).toBe(false);
  });

  it("returns includeStarted for started events when taskId matches or is unset", () => {
    expect(shouldRefreshForEvent(startedEvent, { includeStarted: true, taskId: null })).toBe(true);
    expect(shouldRefreshForEvent(startedEvent, { includeStarted: false, taskId: null })).toBe(false);
  });

  it("returns includeFailed for failed events when taskId matches or is unset", () => {
    expect(shouldRefreshForEvent(failedEvent, { includeFailed: true, taskId: null })).toBe(true);
    expect(shouldRefreshForEvent(failedEvent, { includeFailed: false, taskId: null })).toBe(false);
  });

  it("filters completed events by analysisMode when specified", () => {
    const options: UseRefreshOnAnalysisEventOptions = {
      includeCompleted: true,
      analysisMode: "event",
      taskId: null,
    };
    expect(shouldRefreshForEvent(completedEvent, options)).toBe(false);

    const matching = {
      ...completedEvent,
      payload: { ...completedEvent.payload, analysisMode: "event" },
    };
    expect(shouldRefreshForEvent(matching, options)).toBe(true);

    const otherMode = {
      ...completedEvent,
      payload: { ...completedEvent.payload, analysisMode: "leaderboard" },
    };
    expect(shouldRefreshForEvent(otherMode, options)).toBe(false);
  });

  it("returns false when all include flags are false", () => {
    const opts = { includeStarted: false, includeCompleted: false, includeFailed: false };
    expect(shouldRefreshForEvent(startedEvent, opts)).toBe(false);
    expect(shouldRefreshForEvent(completedEvent, opts)).toBe(false);
    expect(shouldRefreshForEvent(failedEvent, opts)).toBe(false);
  });

  it("returns true when taskId matches and include flag is set", () => {
    const opts = {
      includeStarted: true,
      includeCompleted: true,
      includeFailed: true,
      taskId: "task-a",
    };
    expect(shouldRefreshForEvent(startedEvent, opts)).toBe(true);
    expect(shouldRefreshForEvent(completedEvent, opts)).toBe(true);
    expect(shouldRefreshForEvent(failedEvent, opts)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Regression tests for the Gemini 500 retry classification bug (fixed).
//
// `useRefreshOnAnalysisEvent` now invokes `onRefresh` with a local
// `.catch()` guard (see useRefreshOnAnalysisEvent.ts), so a rejecting
// callback no longer escapes as an unhandled promise rejection. These
// tests guard against regressing to the bare `void onRefresh()` call.
// ---------------------------------------------------------------------------

describe("useRefreshOnAnalysisEvent — bug condition exploration", () => {
  beforeEach(() => {
    analysisStatusMode.current = "mock";
    runtimeState.lastAnalysisEvent = null;
  });

  afterEach(() => {
    runtimeState.lastAnalysisEvent = null;
  });

  /**
   * Property 5: Frontend analysis-related rejections are handled locally.
   *
   * For any analyze-batch refresh invocation that returns a rejected
   * promise (e.g. the REST endpoint fails with an LLM_ERROR), the hook
   * SHALL catch the rejection locally so the rejection does NOT escape
   * as an unhandled promise rejection (the event path that the
   * production `window.unhandledrejection` listener logs as
   * `未處理的非同步錯誤`).
   *
   * Regression scenario guarded against: a bare `void onRefresh()` call
   * would let the rejection escape as an unhandled rejection (captured
   * by Node's process-level handler in the test environment, which is
   * the analogue of the production `window.unhandledrejection`
   * listener).
   *
   * Validates: Requirements 2.4
   */
  it("prop_analyze_batch_rejection_is_handled: rejected onRefresh does not fire an unhandled rejection", async () => {
    const unhandledReasons: unknown[] = [];

    // jsdom + Vitest dispatch unhandled rejections at the Node process
    // level (not as a DOM `unhandledrejection` event) under the current
    // runner, so we hook both layers:
    //   * `window.unhandledrejection` — the DOM event path subscribed
    //     to by `useRuntimeMonitoring` in production.
    //   * `process.on('unhandledRejection')` — what the test runner
    //     actually receives when a bare `void onRefresh()` call leaves
    //     a rejected promise without a handler.
    // `prependListener` ensures our observer runs before Vitest's own
    // handler, which otherwise swallows/transforms the event.
    const onDomUnhandled = (event: PromiseRejectionEvent) => {
      unhandledReasons.push(event.reason);
      event.preventDefault();
    };
    const onNodeUnhandled = (reason: unknown) => {
      unhandledReasons.push(reason);
    };

    window.addEventListener("unhandledrejection", onDomUnhandled);
    process.prependListener("unhandledRejection", onNodeUnhandled);

    try {
      // A real async function that rejects — equivalent to the REST
      // endpoint returning `LLM_ERROR`. Using a plain async function
      // (not `vi.fn().mockRejectedValue(...)`) avoids any library
      // internals that might attach an implicit `.catch()`.
      const onRefresh = async (): Promise<void> => {
        throw new Error("LLM_ERROR");
      };

      const { container, root } = renderHarness(
        <Harness onRefresh={onRefresh as unknown as () => void} />,
      );

      runtimeState.lastAnalysisEvent = {
        type: "completed",
        payload: {
          taskId: "task-1",
          batchId: "batch-1",
          analysisMode: "leaderboard",
          findingsCount: 1,
          hasFindings: true,
          overlapStatistics: null,
        },
        receivedAt: 1,
      };
      await rerenderHarness(
        root,
        <Harness onRefresh={onRefresh as unknown as () => void} />,
      );

      // Give the microtask queue and the unhandled-rejection hook a
      // chance to fire. Node emits `unhandledRejection` on the next
      // macro-tick after the microtask queue drains with no handler
      // attached to the promise.
      await new Promise<void>((resolve) => setTimeout(resolve, 10));
      await new Promise<void>((resolve) => setTimeout(resolve, 20));
      await new Promise<void>((resolve) => setTimeout(resolve, 20));

      expect(unhandledReasons).toEqual([]);

      cleanupHarness(root, container);
    } finally {
      window.removeEventListener("unhandledrejection", onDomUnhandled);
      process.off("unhandledRejection", onNodeUnhandled);
    }
  });
});

// ---------------------------------------------------------------------------
// Preservation tests for the Gemini 500 retry classification bug.
//
// These tests pin behaviour that the local `.catch()` guard must NOT
// change. In particular, rejections that
// originate from code paths OTHER than an analyze-batch refresh must
// still reach the global `unhandledrejection` listener so
// `buildUnhandledRejectionLog` continues to emit
// `未處理的非同步錯誤` in the runtime monitoring log.
// ---------------------------------------------------------------------------

describe("useRefreshOnAnalysisEvent — preservation", () => {
  beforeEach(() => {
    analysisStatusMode.current = "mock";
    runtimeState.lastAnalysisEvent = null;
  });

  afterEach(() => {
    runtimeState.lastAnalysisEvent = null;
  });

  /**
   * Property 6: Unrelated rejections still reach the global listener.
   *
   * For any promise rejection that does NOT originate from an
   * analyze-batch refresh call-site, the global `unhandledrejection`
   * event SHALL still fire so that `useRuntimeMonitoring` can log
   * `未處理的非同步錯誤` via `buildUnhandledRejectionLog`. This property
   * protects the observability of non-analysis failures from being
   * accidentally suppressed by the fix.
   *
   * We verify the preservation contract directly in two parts:
   *   1. The handler wiring contract — given a synthetic
   *      `PromiseRejectionEvent`-like payload, the runtime monitoring
   *      log helper (`buildUnhandledRejectionLog`) still produces an
   *      entry with the exact Chinese message the production listener
   *      records.
   *   2. The listener path — emitting a rejected promise from a
   *      non-analysis source fires the `window.unhandledrejection`
   *      event (or the Node process-level equivalent in the jsdom +
   *      Vitest environment).
   *
   * Asserting on the log helper directly avoids coupling the test to
   * a fully-mounted `AppRuntimeProvider` (which requires backend
   * API mocks and event streams that aren't configured in this
   * hook test file) while still confirming that the listener
   * contract is intact.
   *
   * Validates: Requirements 3.7
   */
  it("prop_unrelated_rejections_still_logged: non-analysis rejections still surface as 未處理的非同步錯誤", async () => {
    // Part 1 — log-builder contract preservation.
    //
    // `buildUnhandledRejectionLog` is the function
    // `useRuntimeMonitoring` calls from inside its
    // `unhandledrejection` listener. The preservation invariant is
    // that an unrelated rejection reason produces a log entry with
    // level=error, category=system, and message=未處理的非同步錯誤.
    const unrelatedReason = new Error("non-analysis failure");
    const syntheticEvent = {
      reason: unrelatedReason,
    } as unknown as PromiseRejectionEvent;
    const logEntry = buildUnhandledRejectionLog(syntheticEvent);

    expect(logEntry.level).toBe("error");
    expect(logEntry.category).toBe("system");
    expect(logEntry.message).toBe("未處理的非同步錯誤");

    // Part 2 — listener path preservation.
    //
    // Emit a rejected promise from a non-analyze-batch source and
    // confirm the global rejection path fires. The production
    // `useRuntimeMonitoring` listener attaches to
    // `window.unhandledrejection`; Node's process-level handler is
    // the jsdom + Vitest analogue and is what actually observes the
    // rejection in this harness.
    const observedReasons: unknown[] = [];
    const onDomUnhandled = (event: PromiseRejectionEvent) => {
      observedReasons.push(event.reason);
      event.preventDefault();
    };
    const onNodeUnhandled = (reason: unknown) => {
      observedReasons.push(reason);
    };

    window.addEventListener("unhandledrejection", onDomUnhandled);
    process.prependListener("unhandledRejection", onNodeUnhandled);

    try {
      // Non-analysis source: a standalone rejected promise with no
      // attached handler. This simulates an unrelated UI flow (e.g.
      // a background fetch in another component) failing.
      void Promise.reject(unrelatedReason);

      // Flush microtasks and a couple of macro-ticks so Node has a
      // chance to emit `unhandledRejection` for the un-awaited
      // rejection.
      await new Promise<void>((resolve) => setTimeout(resolve, 10));
      await new Promise<void>((resolve) => setTimeout(resolve, 20));
      await new Promise<void>((resolve) => setTimeout(resolve, 20));

      expect(observedReasons).toContain(unrelatedReason);
    } finally {
      window.removeEventListener("unhandledrejection", onDomUnhandled);
      process.off("unhandledRejection", onNodeUnhandled);
    }
  });
});

function makeAnalysisStatusValue(
  overrides: Partial<AnalysisStatusContextValue> = {},
): AnalysisStatusContextValue {
  return {
    queueStatus: null,
    analysisPaused: false,
    activeAnalysis: null,
    activeAnalyses: new Map(),
    lastAnalysisEvent: null,
    lastAccountStatusChange: null,
    lastMessagesUpdate: null,
    requestQueueStatusRefresh: () => {},
    ...overrides,
  };
}

function makeRuntimeLogsValue(
  overrides: Partial<RuntimeLogsContextValue> = {},
): RuntimeLogsContextValue {
  return {
    logs: [],
    totalLogCount: 0,
    hasMoreLogs: false,
    logsLoading: false,
    logsLoadingMore: false,
    logLoadError: null,
    clearLogs: () => {},
    refreshLogs: async () => {},
    loadMoreLogs: async () => {},
    ...overrides,
  };
}

let isolationRenderCount = 0;

const IsolationHookConsumer = React.memo(function IsolationHookConsumer({
  onRefresh,
}: {
  onRefresh: () => void;
}) {
  isolationRenderCount++;
  useRefreshOnAnalysisEvent(onRefresh);
  return null;
});

function IsolationTestWrapper({
  collectorStatus,
  aiEngineStatus,
  analysisValue,
  runtimeLogsValue,
  children,
}: {
  collectorStatus: CollectorStatusProviderProps["collectorStatus"];
  aiEngineStatus: CollectorStatusProviderProps["aiEngineStatus"];
  analysisValue: AnalysisStatusContextValue;
  runtimeLogsValue: RuntimeLogsContextValue;
  children: React.ReactNode;
}) {
  return (
    <CollectorStatusProvider
      collectorStatus={collectorStatus}
      aiEngineStatus={aiEngineStatus}
      requestAiStatusRefresh={() => {}}
    >
      <AnalysisStatusProvider value={analysisValue}>
        <RuntimeLogsContext.Provider value={runtimeLogsValue}>
          {children}
        </RuntimeLogsContext.Provider>
      </AnalysisStatusProvider>
    </CollectorStatusProvider>
  );
}

describe("useRefreshOnAnalysisEvent — context isolation", () => {
  let container: HTMLDivElement;
  let root: Root;
  const onRefresh = vi.fn();

  beforeEach(() => {
    analysisStatusMode.current = "real";
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    isolationRenderCount = 0;
    onRefresh.mockReset();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("does NOT re-render when CollectorStatus context changes", () => {
    const analysisValue = makeAnalysisStatusValue();
    const runtimeLogsValue = makeRuntimeLogsValue();

    act(() => {
      root.render(
        <IsolationTestWrapper
          collectorStatus="stopped"
          aiEngineStatus="unknown"
          analysisValue={analysisValue}
          runtimeLogsValue={runtimeLogsValue}
        >
          <IsolationHookConsumer onRefresh={onRefresh} />
        </IsolationTestWrapper>,
      );
    });

    const rendersAfterMount = isolationRenderCount;
    expect(rendersAfterMount).toBeGreaterThanOrEqual(1);

    act(() => {
      root.render(
        <IsolationTestWrapper
          collectorStatus="running"
          aiEngineStatus="available"
          analysisValue={analysisValue}
          runtimeLogsValue={runtimeLogsValue}
        >
          <IsolationHookConsumer onRefresh={onRefresh} />
        </IsolationTestWrapper>,
      );
    });

    expect(isolationRenderCount).toBe(rendersAfterMount);
  });

  it("does NOT re-render when RuntimeLogs context changes", () => {
    const analysisValue = makeAnalysisStatusValue();
    const runtimeLogsValue1 = makeRuntimeLogsValue({ totalLogCount: 0 });

    act(() => {
      root.render(
        <IsolationTestWrapper
          collectorStatus="running"
          aiEngineStatus="available"
          analysisValue={analysisValue}
          runtimeLogsValue={runtimeLogsValue1}
        >
          <IsolationHookConsumer onRefresh={onRefresh} />
        </IsolationTestWrapper>,
      );
    });

    const rendersAfterMount = isolationRenderCount;
    expect(rendersAfterMount).toBeGreaterThanOrEqual(1);

    const runtimeLogsValue2 = makeRuntimeLogsValue({
      totalLogCount: 5,
      logs: [
        {
          level: "info",
          category: "system",
          message: "test log",
          timestamp: Date.now(),
        },
      ] as RuntimeLogsContextValue["logs"],
    });

    act(() => {
      root.render(
        <IsolationTestWrapper
          collectorStatus="running"
          aiEngineStatus="available"
          analysisValue={analysisValue}
          runtimeLogsValue={runtimeLogsValue2}
        >
          <IsolationHookConsumer onRefresh={onRefresh} />
        </IsolationTestWrapper>,
      );
    });

    expect(isolationRenderCount).toBe(rendersAfterMount);
  });

  it("DOES re-render when AnalysisStatus context changes", () => {
    const analysisValue1 = makeAnalysisStatusValue();
    const runtimeLogsValue = makeRuntimeLogsValue();

    act(() => {
      root.render(
        <IsolationTestWrapper
          collectorStatus="running"
          aiEngineStatus="available"
          analysisValue={analysisValue1}
          runtimeLogsValue={runtimeLogsValue}
        >
          <IsolationHookConsumer onRefresh={onRefresh} />
        </IsolationTestWrapper>,
      );
    });

    const rendersAfterMount = isolationRenderCount;

    const analysisValue2 = makeAnalysisStatusValue({
      lastAnalysisEvent: {
        type: "completed",
        payload: {
          taskId: "task-1",
          batchId: "batch-1",
          analysisMode: "leaderboard",
          findingsCount: 1,
          hasFindings: true,
          overlapStatistics: null,
        },
        receivedAt: Date.now(),
      },
    });

    act(() => {
      root.render(
        <IsolationTestWrapper
          collectorStatus="running"
          aiEngineStatus="available"
          analysisValue={analysisValue2}
          runtimeLogsValue={runtimeLogsValue}
        >
          <IsolationHookConsumer onRefresh={onRefresh} />
        </IsolationTestWrapper>,
      );
    });

    expect(isolationRenderCount).toBeGreaterThan(rendersAfterMount);
  });
});
