import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppLogEntry } from "../../context/appRuntimeShared";

const runtimeState = {
  logs: [] as AppLogEntry[],
  totalLogCount: 0,
  hasMoreLogs: false,
  logsLoading: false,
  logsLoadingMore: false,
  logLoadError: null as string | null,
  activeAnalyses: new Map(),
  lastMessagesUpdate: null,
  clearLogs: vi.fn(),
  refreshLogs: vi.fn(async () => {}),
  loadMoreLogs: vi.fn(async () => {}),
};

vi.mock("../../context/runtimeLogs/RuntimeLogsContext", () => ({
  useRuntimeLogs: () => ({
    logs: runtimeState.logs,
    totalLogCount: runtimeState.totalLogCount,
    hasMoreLogs: runtimeState.hasMoreLogs,
    logsLoading: runtimeState.logsLoading,
    logsLoadingMore: runtimeState.logsLoadingMore,
    logLoadError: runtimeState.logLoadError,
    clearLogs: runtimeState.clearLogs,
    refreshLogs: runtimeState.refreshLogs,
    loadMoreLogs: runtimeState.loadMoreLogs,
  }),
}));

vi.mock("../../context/AnalysisStatusContext", () => ({
  useAnalysisStatus: () => ({
    activeAnalyses: runtimeState.activeAnalyses,
    lastMessagesUpdate: runtimeState.lastMessagesUpdate,
  }),
}));

vi.mock("../../hooks/useInfiniteScroll", () => ({
  useInfiniteScroll: vi.fn(),
}));

import { useLogPage } from "./useLogPage";

function makeLog(overrides: Partial<AppLogEntry> = {}): AppLogEntry {
  return {
    id: "log-1",
    time: "2026-04-17T03:00:00.000Z",
    level: "info",
    category: "system",
    kind: "event",
    message: "hello world",
    details: undefined,
    ...overrides,
  };
}

let latest: ReturnType<typeof useLogPage> | null = null;

function Harness() {
  latest = useLogPage();
  return null;
}

describe("useLogPage", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    latest = null;
    localStorage.clear();
    runtimeState.logs = [
      makeLog({ id: "log-info", level: "info", category: "system", message: "boot ok" }),
      makeLog({ id: "log-error", level: "error", category: "analysis", message: "batch failed" }),
      makeLog({ id: "log-other", level: "warning", category: "collector", message: "retrying" }),
      makeLog({
        id: "log-fe",
        level: "error",
        category: "frontend",
        kind: "frontend.critical",
        message: "Frontend runtime error",
      }),
      makeLog({
        id: "log-trace",
        level: "info",
        category: "analysis",
        kind: "analysis.trace",
        message: "trace step",
      }),
    ];
    runtimeState.totalLogCount = 5;
    runtimeState.hasMoreLogs = true;
    runtimeState.logsLoading = false;
    runtimeState.logsLoadingMore = false;
    runtimeState.logLoadError = null;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  async function renderHook() {
    await act(async () => {
      root.render(createElement(Harness));
      await Promise.resolve();
    });
  }

  it("filters logs by level, category, and search", async () => {
    await renderHook();

    act(() => {
      latest!.setLevelFilter("error");
    });
    expect(latest!.filteredLogs.map((entry) => entry.id)).toEqual([
      "log-error",
      "log-fe",
    ]);

    act(() => {
      latest!.setCategoryFilter("frontend");
    });
    expect(latest!.filteredLogs.map((entry) => entry.id)).toEqual(["log-fe"]);

    act(() => {
      latest!.setCategoryFilter("collector");
    });
    expect(latest!.filteredLogs).toHaveLength(0);

    act(() => {
      latest!.setLevelFilter("all");
      latest!.setSearch("retry");
    });
    expect(latest!.filteredLogs.map((entry) => entry.id)).toEqual(["log-other"]);
  });

  it("reports active filters and clears them via resetFilters", async () => {
    await renderHook();

    act(() => {
      latest!.setSearch("boot");
    });

    expect(latest!.hasActiveFilters).toBe(true);

    act(() => {
      latest!.resetFilters();
    });

    expect(latest!.search).toBe("");
    expect(latest!.hasActiveFilters).toBe(false);
  });

  it("hides analysis.trace by default and shows them when toggled", async () => {
    await renderHook();

    expect(latest!.showAnalysisTrace).toBe(false);
    expect(latest!.filteredLogs.map((entry) => entry.id)).not.toContain("log-trace");
    expect(latest!.analysisCount).toBe(1);

    act(() => {
      latest!.setShowAnalysisTrace(true);
    });

    expect(latest!.filteredLogs.map((entry) => entry.id)).toContain("log-trace");
    expect(latest!.analysisCount).toBe(2);
  });

  it("computes summary counts from the loaded log buffer", async () => {
    await renderHook();

    expect(latest!.errorCount).toBe(2);
    expect(latest!.analysisCount).toBe(1);
    expect(latest!.loadedLogsSummary).toBe("4 / 5");
  });

  it("persists selected log id across remount", async () => {
    await renderHook();

    act(() => {
      latest!.setSelectedLogId("log-error");
    });
    expect(latest!.selectedLogId).toBe("log-error");
    expect(latest!.selectedLog?.id).toBe("log-error");

    await act(async () => {
      root.unmount();
    });
    root = createRoot(container);
    await renderHook();

    expect(latest!.selectedLogId).toBe("log-error");
    expect(latest!.selectedLog?.id).toBe("log-error");
  });
});
