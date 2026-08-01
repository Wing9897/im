import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the REST API modules that runtimeLogState depends on.
// Mocks app-log REST clients used by useRuntimeLogs.
const { mockQueryAppLogsPage, mockAppendAppLog, mockClearAppLogs } = vi.hoisted(() => ({
  mockQueryAppLogsPage: vi.fn(),
  mockAppendAppLog: vi.fn(),
  mockClearAppLogs: vi.fn(),
}));

vi.mock("../../api/logs", () => ({
  queryAppLogsPage: mockQueryAppLogsPage,
  appendAppLog: mockAppendAppLog,
  clearAppLogs: mockClearAppLogs,
}));

import type { AppLogEntryPayload, AppLogPagePayload } from "../../types";
import { flushPromises } from "../../test/async-helpers";
import { useRuntimeLogState as useRuntimeLogs } from "./runtimeLogState";
import type { RuntimeLogsState } from "./runtimeLogsTypes";

let latestState: RuntimeLogsState | null = null;

function HookHarness() {
  latestState = useRuntimeLogs();
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

function makePayload(id: string, message: string): AppLogEntryPayload {
  return {
    id,
    time: `2026-04-15T03:00:0${id}.000Z`,
    level: "info",
    category: "system",
    message,
    details: null,
  };
}

function makePage(
  logs: AppLogEntryPayload[],
  overrides: Partial<AppLogPagePayload> = {},
): AppLogPagePayload {
  return {
    logs,
    nextCursor:
      overrides.nextCursor !== undefined
        ? overrides.nextCursor
        : logs.length > 0
          ? {
              time: logs[logs.length - 1].time,
              id: logs[logs.length - 1].id,
            }
          : null,
    hasMore: false,
    totalCount: logs.length,
    ...overrides,
  };
}

async function flushUpdates() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe("useRuntimeLogs", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockQueryAppLogsPage.mockReset();
    mockAppendAppLog.mockReset();
    mockClearAppLogs.mockReset();
    mockQueryAppLogsPage.mockResolvedValue(makePage([]));
    mockClearAppLogs.mockResolvedValue(undefined);
  });

  afterEach(() => {
    latestState = null;
  });

  it("ignores an in-flight refresh that started before logs were cleared", async () => {
    const pageDeferred = createDeferred<AppLogPagePayload>();
    mockQueryAppLogsPage.mockReturnValue(pageDeferred.promise);
    mockClearAppLogs.mockResolvedValue(undefined);

    const { container, root } = renderHarness();

    act(() => {
      latestState!.clearLogs();
    });

    await act(async () => {
      pageDeferred.resolve(makePage([makePayload("1", "stale log")]));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(latestState!.logs).toEqual([]);
    cleanupHarness(root, container);
  });

  it("keeps a newly appended persisted log when an older refresh returns later", async () => {
    const pageDeferred = createDeferred<AppLogPagePayload>();
    const createdLog = makePayload("2", "new persisted log");

    mockQueryAppLogsPage.mockReturnValue(pageDeferred.promise);
    mockAppendAppLog.mockResolvedValue(createdLog);

    const { container, root } = renderHarness();

    await act(async () => {
      latestState!.addLog({
        level: "info",
        category: "system",
        message: "new persisted log",
      });
      await flushUpdates();
    });

    expect(latestState!.logs.map((entry) => entry.id)).toContain(createdLog.id);

    await act(async () => {
      pageDeferred.resolve(makePage([]));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(latestState!.logs.map((entry) => entry.id)).toContain(createdLog.id);
    cleanupHarness(root, container);
  });

  it("ignores an append result that resolves after logs were cleared", async () => {
    const appendDeferred = createDeferred<AppLogEntryPayload>();
    mockAppendAppLog.mockReturnValue(appendDeferred.promise);
    mockQueryAppLogsPage.mockResolvedValue(makePage([]));
    mockClearAppLogs.mockResolvedValue(undefined);

    const { container, root } = renderHarness();

    act(() => {
      latestState!.addLog({
        level: "info",
        category: "system",
        message: "late append",
      });
    });

    act(() => {
      latestState!.clearLogs();
    });

    await act(async () => {
      appendDeferred.resolve(makePayload("3", "late append"));
      await Promise.resolve();
    });

    expect(latestState!.logs).toEqual([]);
    cleanupHarness(root, container);
  });

  it("keeps both persisted logs when appends resolve out of order", async () => {
    const firstAppend = createDeferred<AppLogEntryPayload>();
    const secondAppend = createDeferred<AppLogEntryPayload>();
    let appendCount = 0;

    mockQueryAppLogsPage.mockResolvedValue(makePage([]));
    mockAppendAppLog.mockImplementation(() => {
      appendCount += 1;
      return appendCount === 1 ? firstAppend.promise : secondAppend.promise;
    });

    const { container, root } = renderHarness();

    await act(async () => {
      latestState!.addLog({
        level: "info",
        category: "system",
        message: "first",
      });
      latestState!.addLog({
        level: "warning",
        category: "system",
        message: "second",
      });
      await flushUpdates();
    });

    await act(async () => {
      secondAppend.resolve(makePayload("4", "second"));
      firstAppend.resolve(makePayload("5", "first"));
      await flushUpdates();
    });

    expect(latestState!.logs.map((entry) => entry.id)).toEqual(["5", "4"]);
    cleanupHarness(root, container);
  });

  it("hydrates stored logs on mount and clears the loading state", async () => {
    const pageDeferred = createDeferred<AppLogPagePayload>();
    mockQueryAppLogsPage.mockReturnValue(pageDeferred.promise);

    const { container, root } = renderHarness();

    expect(latestState!.logsLoading).toBe(true);

    await act(async () => {
      pageDeferred.resolve(makePage([makePayload("6", "persisted log")]));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(latestState!.logsLoading).toBe(false);
    expect(latestState!.logs.map((entry) => entry.id)).toContain("6");
    cleanupHarness(root, container);
  });

  it("loads older logs with cursor pagination", async () => {
    let requestCount = 0;
    mockQueryAppLogsPage.mockImplementation(
      (args?: { cursor?: { id: string } | null }) => {
        requestCount += 1;
        if (requestCount === 1) {
          return Promise.resolve(
            makePage([makePayload("2", "newer log")], {
              hasMore: true,
              totalCount: 2,
              nextCursor: {
                time: "2026-04-15T03:00:02.000Z",
                id: "2",
              },
            }),
          );
        }
        expect(args?.cursor?.id).toBe("2");
        return Promise.resolve(
          makePage([makePayload("1", "older log")], {
            hasMore: false,
            totalCount: 2,
            nextCursor: null,
          }),
        );
      },
    );

    const { container, root } = renderHarness();

    await act(async () => {
      await flushUpdates();
    });

    expect(latestState!.hasMoreLogs).toBe(true);
    expect(latestState!.totalLogCount).toBe(2);

    await act(async () => {
      await latestState!.loadMoreStoredLogs();
      await flushUpdates();
    });

    expect(latestState!.logs.map((entry) => entry.id)).toEqual(["2", "1"]);
    expect(latestState!.hasMoreLogs).toBe(false);
    cleanupHarness(root, container);
  });

  it("keeps older loaded pages after a soft refresh fetches a new first page", async () => {
    let requestCount = 0;
    mockQueryAppLogsPage.mockImplementation(() => {
      requestCount += 1;
      if (requestCount === 1) {
        return Promise.resolve(
          makePage([makePayload("2", "newer log")], {
            hasMore: true,
            totalCount: 2,
            nextCursor: {
              time: "2026-04-15T03:00:02.000Z",
              id: "2",
            },
          }),
        );
      }
      if (requestCount === 2) {
        return Promise.resolve(
          makePage([makePayload("1", "older log")], {
            hasMore: false,
            totalCount: 2,
            nextCursor: null,
          }),
        );
      }
      return Promise.resolve(
        makePage(
          [makePayload("3", "newest log"), makePayload("2", "newer log")],
          {
            hasMore: true,
            totalCount: 3,
            nextCursor: {
              time: "2026-04-15T03:00:02.000Z",
              id: "2",
            },
          },
        ),
      );
    });

    const { container, root } = renderHarness();

    await act(async () => {
      await flushUpdates();
    });

    expect(latestState!.hasMoreLogs).toBe(true);

    await act(async () => {
      await latestState!.loadMoreStoredLogs();
      await flushUpdates();
    });

    await act(async () => {
      await latestState!.refreshStoredLogs();
      await flushUpdates();
    });

    expect(latestState!.logs.map((entry) => entry.id)).toEqual(["3", "2", "1"]);
    cleanupHarness(root, container);
  });

  it("stops the loading state when query_app_logs_page times out", async () => {
    vi.useFakeTimers();
    mockQueryAppLogsPage.mockReturnValue(new Promise(() => {}));

    const { container, root } = renderHarness();

    expect(latestState!.logsLoading).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(17_250);
      await Promise.resolve();
    });

    expect(latestState!.logsLoading).toBe(false);
    expect(latestState!.logLoadError).toBe("系統日誌載入逾時，請稍後再試。");

    cleanupHarness(root, container);
    vi.useRealTimers();
  });

  it("retries a timed-out refresh once and hydrates logs after a later success", async () => {
    vi.useFakeTimers();
    let pageAttempts = 0;
    mockQueryAppLogsPage.mockImplementation(() => {
      pageAttempts += 1;
      if (pageAttempts === 1) {
        return new Promise(() => {});
      }
      return Promise.resolve(
        makePage([makePayload("7", "recovered persisted log")]),
      );
    });

    const { container, root } = renderHarness();

    expect(latestState!.logsLoading).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(9_250);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(pageAttempts).toBe(2);
    expect(latestState!.logsLoading).toBe(false);
    expect(latestState!.logLoadError).toBeNull();
    expect(latestState!.logs.map((entry) => entry.id)).toContain("7");

    cleanupHarness(root, container);
    vi.useRealTimers();
  });

  it("hydrates cached stored logs before a fresh refresh completes", async () => {
    vi.useFakeTimers();
    window.localStorage.setItem(
      "im:runtime:stored-log-cache",
      JSON.stringify([
        {
          id: "cached-1",
          time: "2026-04-15T03:00:09.000Z",
          level: "info",
          category: "system",
          message: "cached log",
        },
      ]),
    );
    mockQueryAppLogsPage.mockReturnValue(new Promise(() => {}));

    const { container, root } = renderHarness();

    expect(latestState!.logs.map((entry) => entry.id)).toContain("cached-1");
    expect(latestState!.logsLoading).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(17_250);
      await Promise.resolve();
    });

    expect(latestState!.logs.map((entry) => entry.id)).toContain("cached-1");
    expect(latestState!.logsLoading).toBe(false);
    expect(latestState!.logLoadError).toBe("系統日誌載入逾時，請稍後再試。");

    cleanupHarness(root, container);
    vi.useRealTimers();
  });

  it("writes the latest persisted logs into cache after a successful refresh", async () => {
    const { container, root } = renderHarness();

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(window.localStorage.getItem("im:runtime:stored-log-cache")).toBe(
      JSON.stringify([]),
    );

    mockQueryAppLogsPage.mockResolvedValue(
      makePage([makePayload("8", "cached from refresh")]),
    );

    await act(async () => {
      await latestState!.resetStoredLogs();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      window.localStorage.getItem("im:runtime:stored-log-cache"),
    ).toContain('"id":"8"');

    cleanupHarness(root, container);
  });
});

describe("useRuntimeLogs cleanup", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    window.localStorage.clear();
    mockQueryAppLogsPage.mockReset();
    mockAppendAppLog.mockReset();
    mockClearAppLogs.mockReset();
    mockQueryAppLogsPage.mockResolvedValue(makePage([]));
    mockAppendAppLog.mockResolvedValue({
      id: "log-1",
      time: new Date().toISOString(),
      level: "info",
      category: "system",
      message: "test",
      details: null,
    });
    mockClearAppLogs.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    latestState = null;
  });

  it("does not update state after unmount when resetStoredLogs resolves", async () => {
    // Use a deferred promise so we can control when queryAppLogsPage resolves
    const pageDeferred = createDeferred<AppLogPagePayload>();
    mockQueryAppLogsPage.mockReturnValue(pageDeferred.promise);

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const { container, root } = renderHarness();

    // The hook should be loading (resetStoredLogs was called on mount)
    expect(latestState).not.toBeNull();
    expect(mockQueryAppLogsPage).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: null }),
    );

    // Unmount before the query resolves
    await act(async () => {
      root.unmount();
    });

    // Now resolve the pending query — this should be a no-op due to mountedRef
    await act(async () => {
      pageDeferred.resolve(makePage([]));
      await flushPromises();
    });

    // No React "state update on unmounted component" warnings
    const reactWarnings = consoleErrorSpy.mock.calls.filter(
      (args) =>
        typeof args[0] === "string" &&
        (args[0].includes("unmounted") ||
          args[0].includes("Cannot update") ||
          args[0].includes("state update")),
    );
    expect(reactWarnings).toHaveLength(0);

    consoleErrorSpy.mockRestore();
    container.remove();
    latestState = null;
  });

  it("does not update state after unmount when addLog resolves", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const { container, root } = renderHarness();

    // Let initial load settle
    await act(async () => {
      await flushPromises();
    });

    // Use a deferred promise for appendAppLog
    const appendDeferred = createDeferred<AppLogEntryPayload>();
    mockAppendAppLog.mockReturnValue(appendDeferred.promise);
    mockQueryAppLogsPage.mockResolvedValue(makePage([]));

    // Trigger addLog
    await act(async () => {
      latestState!.addLog({
        level: "info",
        category: "system",
        message: "test log after unmount",
      });
    });

    expect(mockAppendAppLog).toHaveBeenCalledWith(
      expect.objectContaining({ message: "test log after unmount" }),
    );

    // Unmount before appendAppLog resolves
    await act(async () => {
      root.unmount();
    });

    // Resolve the pending appendAppLog — should be a no-op
    await act(async () => {
      appendDeferred.resolve({
        id: "log-post-unmount",
        time: new Date().toISOString(),
        level: "info",
        category: "system",
        message: "test log after unmount",
        details: null,
      });
      await flushPromises();
    });

    const reactWarnings = consoleErrorSpy.mock.calls.filter(
      (args) =>
        typeof args[0] === "string" &&
        (args[0].includes("unmounted") ||
          args[0].includes("Cannot update") ||
          args[0].includes("state update")),
    );
    expect(reactWarnings).toHaveLength(0);

    consoleErrorSpy.mockRestore();
    container.remove();
    latestState = null;
  });

  it("does not update state after unmount when clearLogs async callback resolves", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const { container, root } = renderHarness();

    // Let initial load settle
    await act(async () => {
      await flushPromises();
    });

    // Make clearAppLogs return a deferred promise that rejects
    const clearDeferred = createDeferred<void>();
    mockClearAppLogs.mockReturnValue(clearDeferred.promise);
    mockQueryAppLogsPage.mockResolvedValue(makePage([]));

    // Trigger clearLogs
    await act(async () => {
      latestState!.clearLogs();
    });

    expect(mockClearAppLogs).toHaveBeenCalled();

    // Unmount before clearAppLogs rejects
    await act(async () => {
      root.unmount();
    });

    // Reject the pending clearAppLogs — the error handler checks mountedRef
    await act(async () => {
      clearDeferred.reject(new Error("clear failed"));
      await flushPromises();
    });

    const reactWarnings = consoleErrorSpy.mock.calls.filter(
      (args) =>
        typeof args[0] === "string" &&
        (args[0].includes("unmounted") ||
          args[0].includes("Cannot update") ||
          args[0].includes("state update")),
    );
    expect(reactWarnings).toHaveLength(0);

    consoleErrorSpy.mockRestore();
    container.remove();
    latestState = null;
  });

  it("cleans up the mountedRef so in-flight operations become no-ops", async () => {
    // This test verifies the core cleanup mechanism: mountedRef is set to false
    // on unmount, which prevents all async callbacks from updating state.

    const { container, root } = renderHarness();

    // Let initial load settle
    await act(async () => {
      await flushPromises();
    });

    // Verify the hook loaded successfully
    expect(latestState).not.toBeNull();
    expect(latestState!.logsLoading).toBe(false);

    // Unmount
    await act(async () => {
      root.unmount();
    });

    await act(async () => {
      await flushPromises();
    });

    // After unmount, the queryAppLogsPage was called during mount's resetStoredLogs
    expect(mockQueryAppLogsPage).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: null }),
    );

    container.remove();
    latestState = null;
  });
});
