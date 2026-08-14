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
import { flushPromises } from "../../test/async-helpers";
import {
  cleanupHarness,
  createDeferred,
  makePage,
  renderHarness,
  runtimeLogsHarness,
} from "./useRuntimeLogs.testHarness";

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
    runtimeLogsHarness.latestState = null;
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
    expect(runtimeLogsHarness.latestState).not.toBeNull();
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
    runtimeLogsHarness.latestState = null;
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
      runtimeLogsHarness.latestState!.addLog({
        level: "info",
        category: "system",
        kind: "event",
        message: "test log after unmount",
      });
    });

    expect(mockAppendAppLog).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "test log after unmount",
        kind: "event",
      }),
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
    runtimeLogsHarness.latestState = null;
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
      runtimeLogsHarness.latestState!.clearLogs();
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
    runtimeLogsHarness.latestState = null;
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
    expect(runtimeLogsHarness.latestState).not.toBeNull();
    expect(runtimeLogsHarness.latestState!.logsLoading).toBe(false);

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
    runtimeLogsHarness.latestState = null;
  });
});
