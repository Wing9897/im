import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
import {
  cleanupHarness,
  createDeferred,
  flushUpdates,
  makePage,
  makePayload,
  renderHarness,
  runtimeLogsHarness,
} from "./useRuntimeLogs.testHarness";

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
    runtimeLogsHarness.latestState = null;
  });

  it("ignores an in-flight refresh that started before logs were cleared", async () => {
    const pageDeferred = createDeferred<AppLogPagePayload>();
    mockQueryAppLogsPage.mockReturnValue(pageDeferred.promise);
    mockClearAppLogs.mockResolvedValue(undefined);

    const { container, root } = renderHarness();

    act(() => {
      runtimeLogsHarness.latestState!.clearLogs();
    });

    await act(async () => {
      pageDeferred.resolve(makePage([makePayload("1", "stale log")]));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(runtimeLogsHarness.latestState!.logs).toEqual([]);
    cleanupHarness(root, container);
  });

  it("keeps a newly appended persisted log when an older refresh returns later", async () => {
    const pageDeferred = createDeferred<AppLogPagePayload>();
    const createdLog = makePayload("2", "new persisted log");

    mockQueryAppLogsPage.mockReturnValue(pageDeferred.promise);
    mockAppendAppLog.mockResolvedValue(createdLog);

    const { container, root } = renderHarness();

    await act(async () => {
      runtimeLogsHarness.latestState!.addLog({
        level: "info",
        category: "system",
        kind: "event",
        message: "new persisted log",
      });
      await flushUpdates();
    });

    expect(runtimeLogsHarness.latestState!.logs.map((entry) => entry.id)).toContain(createdLog.id);

    await act(async () => {
      pageDeferred.resolve(makePage([]));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(runtimeLogsHarness.latestState!.logs.map((entry) => entry.id)).toContain(createdLog.id);
    cleanupHarness(root, container);
  });

  it("ignores an append result that resolves after logs were cleared", async () => {
    const appendDeferred = createDeferred<AppLogEntryPayload>();
    mockAppendAppLog.mockReturnValue(appendDeferred.promise);
    mockQueryAppLogsPage.mockResolvedValue(makePage([]));
    mockClearAppLogs.mockResolvedValue(undefined);

    const { container, root } = renderHarness();

    act(() => {
      runtimeLogsHarness.latestState!.addLog({
        level: "info",
        category: "system",
        kind: "event",
        message: "late append",
      });
    });

    act(() => {
      runtimeLogsHarness.latestState!.clearLogs();
    });

    await act(async () => {
      appendDeferred.resolve(makePayload("3", "late append"));
      await Promise.resolve();
    });

    expect(runtimeLogsHarness.latestState!.logs).toEqual([]);
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
      runtimeLogsHarness.latestState!.addLog({
        level: "info",
        category: "system",
        kind: "event",
        message: "first",
      });
      runtimeLogsHarness.latestState!.addLog({
        level: "warning",
        category: "system",
        kind: "event",
        message: "second",
      });
      await flushUpdates();
    });

    await act(async () => {
      secondAppend.resolve(makePayload("4", "second"));
      firstAppend.resolve(makePayload("5", "first"));
      await flushUpdates();
    });

    expect(runtimeLogsHarness.latestState!.logs.map((entry) => entry.id)).toEqual(["5", "4"]);
    cleanupHarness(root, container);
  });

  it("hydrates stored logs on mount and clears the loading state", async () => {
    const pageDeferred = createDeferred<AppLogPagePayload>();
    mockQueryAppLogsPage.mockReturnValue(pageDeferred.promise);

    const { container, root } = renderHarness();

    expect(runtimeLogsHarness.latestState!.logsLoading).toBe(true);

    await act(async () => {
      pageDeferred.resolve(makePage([makePayload("6", "persisted log")]));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(runtimeLogsHarness.latestState!.logsLoading).toBe(false);
    expect(runtimeLogsHarness.latestState!.logs.map((entry) => entry.id)).toContain("6");
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

    expect(runtimeLogsHarness.latestState!.hasMoreLogs).toBe(true);
    expect(runtimeLogsHarness.latestState!.totalLogCount).toBe(2);

    await act(async () => {
      await runtimeLogsHarness.latestState!.loadMoreStoredLogs();
      await flushUpdates();
    });

    expect(runtimeLogsHarness.latestState!.logs.map((entry) => entry.id)).toEqual(["2", "1"]);
    expect(runtimeLogsHarness.latestState!.hasMoreLogs).toBe(false);
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

    expect(runtimeLogsHarness.latestState!.hasMoreLogs).toBe(true);

    await act(async () => {
      await runtimeLogsHarness.latestState!.loadMoreStoredLogs();
      await flushUpdates();
    });

    await act(async () => {
      await runtimeLogsHarness.latestState!.refreshStoredLogs();
      await flushUpdates();
    });

    expect(runtimeLogsHarness.latestState!.logs.map((entry) => entry.id)).toEqual(["3", "2", "1"]);
    cleanupHarness(root, container);
  });

  it("stops the loading state when query_app_logs_page times out", async () => {
    vi.useFakeTimers();
    mockQueryAppLogsPage.mockReturnValue(new Promise(() => {}));

    const { container, root } = renderHarness();

    expect(runtimeLogsHarness.latestState!.logsLoading).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(17_250);
      await Promise.resolve();
    });

    expect(runtimeLogsHarness.latestState!.logsLoading).toBe(false);
    expect(runtimeLogsHarness.latestState!.logLoadError).toBe("系統日誌載入逾時，請稍後再試。");

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

    expect(runtimeLogsHarness.latestState!.logsLoading).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(9_250);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(pageAttempts).toBe(2);
    expect(runtimeLogsHarness.latestState!.logsLoading).toBe(false);
    expect(runtimeLogsHarness.latestState!.logLoadError).toBeNull();
    expect(runtimeLogsHarness.latestState!.logs.map((entry) => entry.id)).toContain("7");

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

    expect(runtimeLogsHarness.latestState!.logs.map((entry) => entry.id)).toContain("cached-1");
    expect(runtimeLogsHarness.latestState!.logsLoading).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(17_250);
      await Promise.resolve();
    });

    expect(runtimeLogsHarness.latestState!.logs.map((entry) => entry.id)).toContain("cached-1");
    expect(runtimeLogsHarness.latestState!.logsLoading).toBe(false);
    expect(runtimeLogsHarness.latestState!.logLoadError).toBe("系統日誌載入逾時，請稍後再試。");

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
      await runtimeLogsHarness.latestState!.resetStoredLogs();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      window.localStorage.getItem("im:runtime:stored-log-cache"),
    ).toContain('"id":"8"');

    cleanupHarness(root, container);
  });
});

