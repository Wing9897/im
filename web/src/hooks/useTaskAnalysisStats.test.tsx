import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — backend REST API + analysis-event context.
// We mock at the api/results module level (replacing the old Tauri invoke mock).
// ---------------------------------------------------------------------------
const { mockFetchTaskAnalysisStats, runtimeState, mockLogWarn } = vi.hoisted(() => ({
  mockFetchTaskAnalysisStats: vi.fn(),
  runtimeState: {
    lastAnalysisEvent: null as unknown,
    lastMessagesUpdate: null as unknown,
  },
  mockLogWarn: vi.fn(),
}));

vi.mock("../api/results", () => ({
  fetchTaskAnalysisStats: (...args: unknown[]) => mockFetchTaskAnalysisStats(...args),
}));

vi.mock("../context/AnalysisStatusContext", () => ({
  useAnalysisStatus: () => runtimeState,
}));

vi.mock("../utils/logger", () => ({
  logWarn: mockLogWarn,
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

import { flushMicrotasks } from "../test/async-helpers";

import { useTaskAnalysisStats } from "./useTaskAnalysisStats";
import type { TaskAnalysisStats } from "../types";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1500;
const MAX_TOTAL_CALLS = 1 + MAX_RETRIES;

function makeStats(unanalyzedCount: number, taskId = "task-1"): TaskAnalysisStats {
  return {
    taskId,
    analyzedCount: 0,
    unanalyzedCount,
    queuedMessageCount: 0,
  };
}

async function flushHookMicrotasks() {
  await act(async () => {
    await flushMicrotasks();
    await flushMicrotasks();
    await flushMicrotasks();
    await flushMicrotasks();
  });
}

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------
let latest: ReturnType<typeof useTaskAnalysisStats> | null = null;

function Harness({ timeRange }: { timeRange: string }) {
  latest = useTaskAnalysisStats({ timeRange, logPrefix: "[test]" });
  return null;
}

function renderHarness(timeRange = "24h") {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<Harness timeRange={timeRange} />);
  });
  return { container, root };
}

function cleanup(root: Root, container: HTMLElement) {
  act(() => {
    root.unmount();
  });
  container.remove();
}

async function flushAsync() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

const SAMPLE_STATS: TaskAnalysisStats[] = [
  {
    taskId: "task-1",
    analyzedCount: 3,
    unanalyzedCount: 0,
    queuedMessageCount: 0,
  },
];

// ---------------------------------------------------------------------------
// Error-path tests
// ---------------------------------------------------------------------------
describe("useTaskAnalysisStats — error paths", () => {
  beforeEach(() => {
    mockFetchTaskAnalysisStats.mockReset();
    mockLogWarn.mockReset();
    runtimeState.lastAnalysisEvent = null;
    latest = null;
  });

  afterEach(() => {
    latest = null;
  });

  it("network failure on initial fetch: keeps taskStats empty and logs warning", async () => {
    mockFetchTaskAnalysisStats.mockRejectedValueOnce(new Error("RPC connection refused"));

    const { container, root } = renderHarness();
    await flushAsync();

    expect(mockFetchTaskAnalysisStats).toHaveBeenCalledTimes(1);
    expect(latest!.taskStats).toEqual([]);
    expect(mockLogWarn).toHaveBeenCalledTimes(1);
    expect(mockLogWarn).toHaveBeenCalledWith(
      "[test] failed to refresh task stats",
      expect.any(Error),
    );

    cleanup(root, container);
  });

  it("network failure on manual refresh: state stays consistent (no crash)", async () => {
    // First call succeeds, second (manual refresh) fails.
    mockFetchTaskAnalysisStats
      .mockResolvedValueOnce(SAMPLE_STATS)
      .mockRejectedValueOnce(new Error("backend timeout"));

    const { container, root } = renderHarness();
    await flushAsync();

    expect(latest!.taskStats).toEqual(SAMPLE_STATS);

    act(() => {
      latest!.refreshTaskStats();
    });
    await flushAsync();

    // The refresh failed, so previous data must be preserved (no overwrite
    // with empty/undefined) and the warning must be logged.
    expect(latest!.taskStats).toEqual(SAMPLE_STATS);
    expect(mockLogWarn).toHaveBeenCalledTimes(1);

    cleanup(root, container);
  });

  it("invalid response shape (rejected with non-Error): does not crash", async () => {
    mockFetchTaskAnalysisStats.mockRejectedValueOnce("malformed: missing taskId field");

    const { container, root } = renderHarness();
    await flushAsync();

    expect(latest!.taskStats).toEqual([]);
    // Hook should still surface the failure as a warning rather than crashing.
    expect(mockLogWarn).toHaveBeenCalledTimes(1);

    cleanup(root, container);
  });

  it("stale-request guard: a slow earlier failure does not overwrite a newer success", async () => {
    let rejectFirst: (reason: unknown) => void = () => {};
    const firstPromise = new Promise((_resolve, reject) => {
      rejectFirst = reject;
    });

    mockFetchTaskAnalysisStats
      .mockReturnValueOnce(firstPromise)
      .mockResolvedValueOnce(SAMPLE_STATS);

    const { container, root } = renderHarness();
    // Initial fetch is in flight — kick off a second refresh that will resolve
    // first.
    act(() => {
      latest!.refreshTaskStats();
    });
    await flushAsync();

    expect(latest!.taskStats).toEqual(SAMPLE_STATS);

    // Now resolve the older request with a failure. The hook should ignore it.
    await act(async () => {
      rejectFirst(new Error("slow stale failure"));
      await firstPromise.catch(() => {});
      await Promise.resolve();
    });

    // Stats should still reflect the newer successful response.
    expect(latest!.taskStats).toEqual(SAMPLE_STATS);
    // The stale rejection must NOT have triggered a warning (stale guard).
    expect(mockLogWarn).not.toHaveBeenCalled();

    cleanup(root, container);
  });
});

// ---------------------------------------------------------------------------
// Retry, isolation, and refresh behaviour
// ---------------------------------------------------------------------------
describe("useTaskAnalysisStats — retry and refresh", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockFetchTaskAnalysisStats.mockReset();
    mockLogWarn.mockReset();
    runtimeState.lastAnalysisEvent = null;
    latest = null;
  });

  afterEach(() => {
    vi.useRealTimers();
    latest = null;
  });

  it("stale event-triggered fetch triggers retries, total calls ≤ 1 + MAX_RETRIES", async () => {
    const staleStats = [makeStats(42)];
    mockFetchTaskAnalysisStats.mockResolvedValue(staleStats);

    const { container, root } = renderHarness("24h");
    await flushHookMicrotasks();
    expect(mockFetchTaskAnalysisStats).toHaveBeenCalledTimes(1);

    runtimeState.lastAnalysisEvent = {
      type: "analysis_completed",
      payload: { taskId: "task-1" },
    };
    act(() => {
      root.render(<Harness timeRange="24h" />);
    });
    await flushHookMicrotasks();
    expect(mockFetchTaskAnalysisStats).toHaveBeenCalledTimes(2);

    for (let i = 0; i < MAX_RETRIES; i++) {
      act(() => {
        vi.advanceTimersByTime(RETRY_DELAY_MS + 100);
      });
      await flushHookMicrotasks();
    }

    expect(mockFetchTaskAnalysisStats.mock.calls.length).toBeLessThanOrEqual(1 + MAX_TOTAL_CALLS);
    cleanup(root, container);
  });

  it("once a retry returns changed data, no further retries are scheduled", async () => {
    const staleStats = [makeStats(50)];
    const freshStats = [makeStats(30)];

    mockFetchTaskAnalysisStats
      .mockResolvedValueOnce(staleStats)
      .mockResolvedValueOnce(staleStats)
      .mockResolvedValue(freshStats);

    const { container, root } = renderHarness("24h");
    await flushHookMicrotasks();

    runtimeState.lastAnalysisEvent = { type: "analysis_completed", payload: { taskId: "task-1" } };
    act(() => {
      root.render(<Harness timeRange="24h" />);
    });
    await flushHookMicrotasks();
    runtimeState.lastAnalysisEvent = null;
    act(() => {
      root.render(<Harness timeRange="24h" />);
    });
    await flushHookMicrotasks();

    for (let i = 0; i < MAX_RETRIES + 2; i++) {
      act(() => {
        vi.advanceTimersByTime(RETRY_DELAY_MS + 100);
      });
      await flushHookMicrotasks();
    }

    expect(mockFetchTaskAnalysisStats.mock.calls.length).toBeLessThanOrEqual(2 + MAX_RETRIES + 2);
    expect(latest!.taskStats[0]?.unanalyzedCount).toBe(30);
    cleanup(root, container);
  });

  it("mounting with no events results in exactly one fetch call", () => {
    mockFetchTaskAnalysisStats.mockResolvedValue([makeStats(5)]);

    const { container, root } = renderHarness("7d");
    act(() => {
      vi.runAllTimers();
    });

    expect(mockFetchTaskAnalysisStats.mock.calls.length).toBe(1);
    act(() => {
      vi.advanceTimersByTime(RETRY_DELAY_MS * (MAX_RETRIES + 5));
    });
    expect(mockFetchTaskAnalysisStats.mock.calls.length).toBe(1);

    cleanup(root, container);
  });

  it("two instances with distinct timeRange fetch independently", () => {
    const latestA = { current: null as ReturnType<typeof useTaskAnalysisStats> | null };
    const latestB = { current: null as ReturnType<typeof useTaskAnalysisStats> | null };

    mockFetchTaskAnalysisStats.mockImplementation((timeRange: string) => {
      if (timeRange === "24h") return Promise.resolve([makeStats(10, "task-a")]);
      return Promise.resolve([makeStats(20, "task-b")]);
    });

    function HarnessA() {
      latestA.current = useTaskAnalysisStats({ timeRange: "24h", logPrefix: "[a]" });
      return null;
    }
    function HarnessB() {
      latestB.current = useTaskAnalysisStats({ timeRange: "7d", logPrefix: "[b]" });
      return null;
    }

    const containerA = document.createElement("div");
    const containerB = document.createElement("div");
    document.body.appendChild(containerA);
    document.body.appendChild(containerB);

    const rootA = createRoot(containerA);
    const rootB = createRoot(containerB);

    act(() => {
      rootA.render(<HarnessA />);
      rootB.render(<HarnessB />);
    });
    act(() => {
      vi.runAllTimers();
    });

    expect(mockFetchTaskAnalysisStats.mock.calls.length).toBe(2);
    const calledRanges = mockFetchTaskAnalysisStats.mock.calls.map(
      (c) => c[0] as string,
    );
    expect(calledRanges).toContain("24h");
    expect(calledRanges).toContain("7d");

    act(() => {
      rootA.unmount();
      rootB.unmount();
    });
    containerA.remove();
    containerB.remove();
  });

  it("after analysis event with stale initial fetch, hook eventually updates to fresh stats via retry", async () => {
    const staleStats = [makeStats(80)];
    const freshStats = [makeStats(50)];

    mockFetchTaskAnalysisStats
      .mockResolvedValueOnce(staleStats)
      .mockResolvedValueOnce(staleStats)
      .mockResolvedValue(freshStats);

    const { container, root } = renderHarness("24h");
    await flushHookMicrotasks();
    expect(latest!.taskStats).toEqual(staleStats);

    runtimeState.lastAnalysisEvent = {
      type: "analysis_completed",
      payload: { taskId: "task-1", analysisMode: "leaderboard" },
    };
    act(() => {
      root.render(<Harness timeRange="24h" />);
    });
    await flushHookMicrotasks();
    expect(mockFetchTaskAnalysisStats).toHaveBeenCalledTimes(2);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    await flushHookMicrotasks();

    expect(latest!.taskStats[0]?.unanalyzedCount).toBe(50);
    cleanup(root, container);
  });

  it("manual refresh triggers exactly one additional fetch per invocation", () => {
    mockFetchTaskAnalysisStats
      .mockResolvedValueOnce([makeStats(10)])
      .mockResolvedValue([makeStats(5)]);

    const { container, root } = renderHarness("24h");
    act(() => {
      vi.runAllTimers();
    });
    expect(mockFetchTaskAnalysisStats.mock.calls.length).toBe(1);

    act(() => {
      latest!.refreshTaskStats();
    });
    act(() => {
      vi.runAllTimers();
    });
    expect(mockFetchTaskAnalysisStats.mock.calls.length).toBe(2);

    cleanup(root, container);
  });
});

describe("useTaskAnalysisStats messages_updated refresh", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockFetchTaskAnalysisStats.mockReset();
    mockFetchTaskAnalysisStats.mockResolvedValue([]);
    runtimeState.lastAnalysisEvent = null;
    runtimeState.lastMessagesUpdate = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("refetches when lastMessagesUpdate changes", async () => {
    const { container, root } = renderHarness("24h");
    await flushHookMicrotasks();
    mockFetchTaskAnalysisStats.mockClear();

    runtimeState.lastMessagesUpdate = {
      payload: {
        messages: [
          {
            id: "msg-1",
            channelId: "ch-1",
            content: "新訊息",
            timestamp: new Date().toISOString(),
          },
        ],
      },
      receivedAt: Date.now(),
    };
    act(() => {
      root.render(<Harness timeRange="24h" />);
    });
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    await flushHookMicrotasks();

    expect(mockFetchTaskAnalysisStats).toHaveBeenCalled();
    cleanup(root, container);
  });
});
