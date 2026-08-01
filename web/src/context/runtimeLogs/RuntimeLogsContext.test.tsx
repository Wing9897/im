import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  RuntimeLogsContext,
  useRuntimeLogs,
  type RuntimeLogsContextValue,
} from "./RuntimeLogsContext";

let latestValue: RuntimeLogsContextValue | null = null;

function RuntimeLogsHarness() {
  latestValue = useRuntimeLogs();
  return null;
}

describe("RuntimeLogsContext", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    latestValue = null;
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root!.unmount();
      });
    }
    root = null;
    container.remove();
    vi.restoreAllMocks();
  });

  it("throws a descriptive error when used outside provider", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    expect(() => {
      act(() => {
        root = createRoot(container);
        root.render(<RuntimeLogsHarness />);
      });
    }).toThrow(
      "useRuntimeLogs must be used within a <RuntimeLogsProvider>",
    );

    expect(consoleError).toHaveBeenCalled();
  });

  it("provides runtime logs values from the provider", () => {
    const mockClearLogs = vi.fn();
    const mockRefreshLogs = vi.fn().mockResolvedValue(undefined);
    const mockLoadMoreLogs = vi.fn().mockResolvedValue(undefined);
    const mockLogs = [
      { id: "1", message: "Test log", level: "info", timestamp: Date.now() },
    ];

    const value: RuntimeLogsContextValue = {
      logs: mockLogs as any,
      totalLogCount: 42,
      hasMoreLogs: true,
      logsLoading: false,
      logsLoadingMore: false,
      logLoadError: null,
      clearLogs: mockClearLogs,
      refreshLogs: mockRefreshLogs,
      loadMoreLogs: mockLoadMoreLogs,
    };

    act(() => {
      root = createRoot(container);
      root.render(
        <RuntimeLogsContext.Provider value={value}>
          <RuntimeLogsHarness />
        </RuntimeLogsContext.Provider>,
      );
    });

    expect(latestValue).not.toBeNull();
    expect(latestValue!.logs).toBe(mockLogs);
    expect(latestValue!.totalLogCount).toBe(42);
    expect(latestValue!.hasMoreLogs).toBe(true);
    expect(latestValue!.logsLoading).toBe(false);
    expect(latestValue!.logsLoadingMore).toBe(false);
    expect(latestValue!.logLoadError).toBeNull();
    expect(latestValue!.clearLogs).toBe(mockClearLogs);
    expect(latestValue!.refreshLogs).toBe(mockRefreshLogs);
    expect(latestValue!.loadMoreLogs).toBe(mockLoadMoreLogs);
  });

  it("provides error state from the provider", () => {
    const value: RuntimeLogsContextValue = {
      logs: [],
      totalLogCount: 0,
      hasMoreLogs: false,
      logsLoading: false,
      logsLoadingMore: false,
      logLoadError: "Failed to load logs",
      clearLogs: vi.fn(),
      refreshLogs: vi.fn().mockResolvedValue(undefined),
      loadMoreLogs: vi.fn().mockResolvedValue(undefined),
    };

    act(() => {
      root = createRoot(container);
      root.render(
        <RuntimeLogsContext.Provider value={value}>
          <RuntimeLogsHarness />
        </RuntimeLogsContext.Provider>,
      );
    });

    expect(latestValue!.logLoadError).toBe("Failed to load logs");
    expect(latestValue!.logsLoading).toBe(false);
  });

  it("updates when provider value changes", () => {
    const initialValue: RuntimeLogsContextValue = {
      logs: [],
      totalLogCount: 0,
      hasMoreLogs: false,
      logsLoading: true,
      logsLoadingMore: false,
      logLoadError: null,
      clearLogs: vi.fn(),
      refreshLogs: vi.fn().mockResolvedValue(undefined),
      loadMoreLogs: vi.fn().mockResolvedValue(undefined),
    };

    act(() => {
      root = createRoot(container);
      root.render(
        <RuntimeLogsContext.Provider value={initialValue}>
          <RuntimeLogsHarness />
        </RuntimeLogsContext.Provider>,
      );
    });

    expect(latestValue!.logsLoading).toBe(true);
    expect(latestValue!.totalLogCount).toBe(0);

    const updatedLogs = [
      { id: "1", message: "New log", level: "info", timestamp: Date.now() },
    ];
    const updatedValue: RuntimeLogsContextValue = {
      ...initialValue,
      logs: updatedLogs as any,
      totalLogCount: 1,
      logsLoading: false,
      hasMoreLogs: false,
    };

    act(() => {
      root!.render(
        <RuntimeLogsContext.Provider value={updatedValue}>
          <RuntimeLogsHarness />
        </RuntimeLogsContext.Provider>,
      );
    });

    expect(latestValue!.logsLoading).toBe(false);
    expect(latestValue!.totalLogCount).toBe(1);
    expect(latestValue!.logs).toBe(updatedLogs);
  });
});
