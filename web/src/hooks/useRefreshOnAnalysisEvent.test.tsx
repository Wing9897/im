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

const completedEvent: RuntimeAnalysisEvent = {
  type: "completed",
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

const startedEvent: RuntimeAnalysisEvent = {
  type: "started",
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

const failedEvent: RuntimeAnalysisEvent = {
  type: "failed",
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

describe("useRefreshOnAnalysisEvent", () => {
  beforeEach(() => {
    analysisStatusMode.current = "mock";
    runtimeState.lastAnalysisEvent = null;
  });

  afterEach(() => {
    runtimeState.lastAnalysisEvent = null;
  });

  it("wires completed events to onRefresh and ignores started by default", async () => {
    const onRefresh = vi.fn();
    const { container, root } = renderHarness(
      <Harness onRefresh={onRefresh} />,
    );

    runtimeState.lastAnalysisEvent = {
      ...startedEvent,
      payload: { ...startedEvent.payload, taskId: "task-1" },
      receivedAt: 1,
    };
    await rerenderHarness(root, <Harness onRefresh={onRefresh} />);
    expect(onRefresh).not.toHaveBeenCalled();

    runtimeState.lastAnalysisEvent = {
      ...completedEvent,
      payload: { ...completedEvent.payload, taskId: "task-1", batchId: "batch-1" },
      receivedAt: 2,
    };
    await rerenderHarness(root, <Harness onRefresh={onRefresh} />);
    expect(onRefresh).toHaveBeenCalledTimes(1);

    cleanupHarness(root, container);
  });

  it("honors includeStarted / includeFailed when opted in", async () => {
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
      ...startedEvent,
      payload: { ...startedEvent.payload, taskId: "task-1" },
      receivedAt: 1,
    };
    await rerenderHarness(
      root,
      <Harness onRefresh={onRefresh} options={options} />,
    );

    runtimeState.lastAnalysisEvent = {
      ...failedEvent,
      payload: { ...failedEvent.payload, taskId: "task-1" },
      receivedAt: 2,
    };
    await rerenderHarness(
      root,
      <Harness onRefresh={onRefresh} options={options} />,
    );

    expect(onRefresh).toHaveBeenCalledTimes(2);
    cleanupHarness(root, container);
  });

  it("catches rejected onRefresh so it does not become an unhandled rejection", async () => {
    const unhandledReasons: unknown[] = [];
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
      const onRefresh = async (): Promise<void> => {
        throw new Error("LLM_ERROR");
      };

      const { container, root } = renderHarness(
        <Harness onRefresh={onRefresh as unknown as () => void} />,
      );

      runtimeState.lastAnalysisEvent = {
        ...completedEvent,
        payload: { ...completedEvent.payload, taskId: "task-1", batchId: "batch-1" },
        receivedAt: 1,
      };
      await rerenderHarness(
        root,
        <Harness onRefresh={onRefresh as unknown as () => void} />,
      );

      await new Promise<void>((resolve) => setTimeout(resolve, 30));
      expect(unhandledReasons).toEqual([]);
      cleanupHarness(root, container);
    } finally {
      window.removeEventListener("unhandledrejection", onDomUnhandled);
      process.off("unhandledRejection", onNodeUnhandled);
    }
  });
});

describe("shouldRefreshForEvent", () => {
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

  it("returns includeStarted / includeFailed for matching events", () => {
    expect(shouldRefreshForEvent(startedEvent, { includeStarted: true, taskId: null })).toBe(true);
    expect(shouldRefreshForEvent(startedEvent, { includeStarted: false, taskId: null })).toBe(false);
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
      payload: { ...completedEvent.payload, analysisMode: "event" as const },
    };
    expect(shouldRefreshForEvent(matching, options)).toBe(true);
  });

  it("returns false when all include flags are false; true when taskId matches", () => {
    const allOff = { includeStarted: false, includeCompleted: false, includeFailed: false };
    expect(shouldRefreshForEvent(startedEvent, allOff)).toBe(false);
    expect(shouldRefreshForEvent(completedEvent, allOff)).toBe(false);
    expect(shouldRefreshForEvent(failedEvent, allOff)).toBe(false);

    const allOn = {
      includeStarted: true,
      includeCompleted: true,
      includeFailed: true,
      taskId: "task-a",
    };
    expect(shouldRefreshForEvent(startedEvent, allOn)).toBe(true);
    expect(shouldRefreshForEvent(completedEvent, allOn)).toBe(true);
    expect(shouldRefreshForEvent(failedEvent, allOn)).toBe(true);
  });
});

describe("useRefreshOnAnalysisEvent — preservation", () => {
  it("keeps unrelated rejections logged as 未處理的非同步錯誤", () => {
    const logEntry = buildUnhandledRejectionLog({
      reason: new Error("non-analysis failure"),
    } as unknown as PromiseRejectionEvent);

    expect(logEntry.level).toBe("error");
    expect(logEntry.category).toBe("system");
    expect(logEntry.message).toBe("未處理的非同步錯誤");
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

  it("re-renders only when AnalysisStatus changes", () => {
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

    const afterMount = isolationRenderCount;
    expect(afterMount).toBeGreaterThanOrEqual(1);

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
    expect(isolationRenderCount).toBe(afterMount);

    act(() => {
      root.render(
        <IsolationTestWrapper
          collectorStatus="running"
          aiEngineStatus="available"
          analysisValue={analysisValue}
          runtimeLogsValue={makeRuntimeLogsValue({
            totalLogCount: 5,
            logs: [
              {
                level: "info",
                category: "system",
                message: "test log",
                timestamp: Date.now(),
              },
            ] as RuntimeLogsContextValue["logs"],
          })}
        >
          <IsolationHookConsumer onRefresh={onRefresh} />
        </IsolationTestWrapper>,
      );
    });
    expect(isolationRenderCount).toBe(afterMount);

    act(() => {
      root.render(
        <IsolationTestWrapper
          collectorStatus="running"
          aiEngineStatus="available"
          analysisValue={makeAnalysisStatusValue({
            lastAnalysisEvent: {
              ...completedEvent,
              payload: {
                ...completedEvent.payload,
                taskId: "task-1",
                batchId: "batch-1",
              },
              receivedAt: Date.now(),
            },
          })}
          runtimeLogsValue={runtimeLogsValue}
        >
          <IsolationHookConsumer onRefresh={onRefresh} />
        </IsolationTestWrapper>,
      );
    });
    expect(isolationRenderCount).toBeGreaterThan(afterMount);
  });
});
