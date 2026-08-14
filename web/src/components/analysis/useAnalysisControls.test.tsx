/**
 * Tests for useAnalysisControls optimistic update behavior.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement, useState, act } from "react";
import { createRoot, type Root } from "react-dom/client";

let setAnalysisPausedMockBehavior: "resolve" | "reject" | "timeout" = "resolve";
let setAnalysisPausedRejectError = "Backend error";
let setAnalysisPausedResolvers: Array<() => void> = [];
const setAnalysisPausedPromises: Array<{
  resolve: () => void;
  reject: (e: Error) => void;
}> = [];

const mockSetAnalysisPaused = vi.fn(() => {
  if (setAnalysisPausedMockBehavior === "reject") {
    return Promise.reject(new Error(setAnalysisPausedRejectError));
  }
  if (setAnalysisPausedMockBehavior === "timeout") {
    return new Promise<void>((resolve, reject) => {
      setAnalysisPausedPromises.push({ resolve, reject });
    });
  }
  return new Promise<void>((resolve) => {
    setAnalysisPausedResolvers.push(resolve);
  });
});

vi.mock("../../api/system", () => ({
  emergencyAbortAnalysis: vi.fn(async () => {}),
  setAnalysisPaused: (..._args: unknown[]) => mockSetAnalysisPaused(),
}));

vi.mock("../../context/ToastContext", async () =>
  (await import("../../test/context-mocks")).toastContextModuleMock());

vi.mock("../../hooks/useTaskAnalysisStats", async () =>
  (await import("../../test/task-analysis-stats-mock")).taskAnalysisStatsModuleMock());

vi.mock("../../utils/errors", () => ({
  toErrorMessage: (e: unknown) => (e instanceof Error ? e.message : String(e)),
  handleCommandError: (e: unknown) => (e instanceof Error ? e.message : String(e)),
}));

vi.mock("../../utils/logger", () => ({
  logWarn: vi.fn(),
}));

import {
  AnalysisStatusProvider,
  type AnalysisStatusContextValue,
} from "../../context/AnalysisStatusContext";
import { CollectorStatusProvider } from "../../context/CollectorStatusContext";
import type { ActiveAnalysisState } from "../../context/appRuntimeShared";

const { useAnalysisControls } = await import("./useAnalysisControls");

interface HookResult {
  handleAnalysisPausedChange: (paused: boolean) => Promise<void>;
  updatingAnalysisPaused: boolean;
  statusLabel: string;
}

let latestHookResult: HookResult | null = null;

function HookConsumer() {
  const result = useAnalysisControls();
  latestHookResult = result as unknown as HookResult;
  return null;
}

const stableRequestQueueStatusRefresh = () => {};
const stableRequestAiStatusRefresh = () => {};

function TestHarness({
  analysisPaused,
  activeAnalyses = new Map<string, ActiveAnalysisState>(),
}: {
  analysisPaused: boolean;
  activeAnalyses?: Map<string, ActiveAnalysisState>;
}) {
  const analysisValue: AnalysisStatusContextValue = {
    queueStatus: {
      analysisPaused,
      processingBatches: Array.from(activeAnalyses.keys()).map((id) => ({ batchId: id })),
    } as AnalysisStatusContextValue["queueStatus"],
    analysisPaused,
    activeAnalyses,
    lastAnalysisEvent: null,
    lastSourceStatusChange: null,
    lastMessagesUpdate: null,
    requestQueueStatusRefresh: stableRequestQueueStatusRefresh,
  };

  return createElement(
    CollectorStatusProvider,
    {
      collectorStatus: "running",
      aiEngineStatus: "available",
      requestAiStatusRefresh: stableRequestAiStatusRefresh,
    },
    createElement(AnalysisStatusProvider, { value: analysisValue }, createElement(HookConsumer)),
  );
}

function mountHarness(initialPaused: boolean) {
  const container = document.createElement("div");
  let root: Root | null = null;
  act(() => {
    root = createRoot(container);
    root.render(createElement(TestHarness, { analysisPaused: initialPaused }));
  });
  return { container, root: root! };
}

describe("useAnalysisControls optimistic update", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setAnalysisPausedMockBehavior = "resolve";
    setAnalysisPausedRejectError = "Backend error";
    setAnalysisPausedResolvers = [];
    setAnalysisPausedPromises.length = 0;
    mockSetAnalysisPaused.mockClear();
    latestHookResult = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("applies optimistic update immediately and persists on success (pause)", () => {
    const { root } = mountHarness(false);

    act(() => {
      void latestHookResult!.handleAnalysisPausedChange(true);
    });
    expect(latestHookResult!.updatingAnalysisPaused).toBe(true);

    expect(setAnalysisPausedResolvers.length).toBe(1);
    act(() => {
      setAnalysisPausedResolvers[0]();
      vi.runAllTimers();
    });
    expect(latestHookResult!.updatingAnalysisPaused).toBe(false);

    act(() => root.unmount());
  });

  it("applies optimistic update immediately and persists on success (resume)", () => {
    const { root } = mountHarness(true);

    act(() => {
      void latestHookResult!.handleAnalysisPausedChange(false);
    });
    expect(latestHookResult!.updatingAnalysisPaused).toBe(true);

    act(() => {
      setAnalysisPausedResolvers[0]();
      vi.runAllTimers();
    });
    expect(latestHookResult!.updatingAnalysisPaused).toBe(false);

    act(() => root.unmount());
  });

  it("reverts displayed paused state on backend rejection", async () => {
    setAnalysisPausedMockBehavior = "reject";
    setAnalysisPausedRejectError = "network error";

    const { root } = mountHarness(false);

    await act(async () => {
      latestHookResult!.handleAnalysisPausedChange(true);
      await vi.runAllTimersAsync();
    });

    expect(latestHookResult!.updatingAnalysisPaused).toBe(false);
    expect(latestHookResult!.statusLabel).toBe("系統正常");

    await act(async () => root.unmount());
  });

  it("reverts displayed paused state on timeout", async () => {
    setAnalysisPausedMockBehavior = "timeout";

    const { root } = mountHarness(true);

    await act(async () => {
      latestHookResult!.handleAnalysisPausedChange(false);
    });
    await act(async () => {
      vi.advanceTimersByTime(30_000);
      await Promise.resolve();
    });

    expect(latestHookResult!.updatingAnalysisPaused).toBe(false);
    expect(latestHookResult!.statusLabel).toBe("分析已暫停");

    await act(async () => root.unmount());
  });

  it("immediate optimistic update matches target and post-confirmation converges to backend state", () => {
    const { root } = mountHarness(false);

    expect(latestHookResult!.statusLabel).toBe("系統正常");

    act(() => {
      void latestHookResult!.handleAnalysisPausedChange(true);
    });
    expect(latestHookResult!.statusLabel).toBe("分析已暫停");

    act(() => {
      setAnalysisPausedResolvers[0]();
      vi.runAllTimers();
    });
    expect(latestHookResult!.statusLabel).toBe("系統正常");
    expect(latestHookResult!.updatingAnalysisPaused).toBe(false);

    act(() => root.unmount());
  });
});

describe("useAnalysisControls pause with active analyses", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setAnalysisPausedMockBehavior = "resolve";
    mockSetAnalysisPaused.mockClear();
    latestHookResult = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls setAnalysisPaused when pausing with in-flight batches", () => {
    const activeAnalyses = new Map<string, ActiveAnalysisState>([
      [
        "batch-1",
        {
          taskId: "task-1",
          taskName: "",
          batchId: "batch-1",
          startedAt: new Date(Date.now() - 5000).toISOString(),
          messageCount: 10,
          estimatedTokens: 0,
          llmProvider: "",
          llmModel: "",
        },
      ],
    ]);

    const container = document.createElement("div");
    let root: Root | null = null;
    act(() => {
      root = createRoot(container);
      root.render(createElement(TestHarness, { analysisPaused: false, activeAnalyses }));
    });

    act(() => {
      void latestHookResult!.handleAnalysisPausedChange(true);
      setAnalysisPausedResolvers.forEach((resolve) => resolve());
      vi.runAllTimers();
    });

    expect(mockSetAnalysisPaused).toHaveBeenCalled();
    act(() => root!.unmount());
  });
});
