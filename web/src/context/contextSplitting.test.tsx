import { describe, it, expect, vi } from "vitest";
import { createElement, memo, useState, useCallback, act } from "react";
import { createRoot, type Root } from "react-dom/client";

import {
  CollectorStatusProvider,
  useCollectorStatus,
} from "./CollectorStatusContext";
import {
  AnalysisStatusProvider,
  useAnalysisStatus,
} from "./AnalysisStatusContext";
import { RuntimeLogsContext, useRuntimeLogs } from "./runtimeLogs/RuntimeLogsContext";
import type { RuntimeLogsContextValue } from "./runtimeLogs/RuntimeLogsContext";
import type { AnalysisStatusContextValue } from "./AnalysisStatusContext";
import type { CollectorStatus, AiEngineStatus } from "../types";

const collectorRenderCount = { current: 0 };
const analysisRenderCount = { current: 0 };
const logsRenderCount = { current: 0 };

const CollectorConsumer = memo(function CollectorConsumer() {
  collectorRenderCount.current += 1;
  useCollectorStatus();
  return null;
});

const AnalysisConsumer = memo(function AnalysisConsumer() {
  analysisRenderCount.current += 1;
  useAnalysisStatus();
  return null;
});

const LogsConsumer = memo(function LogsConsumer() {
  logsRenderCount.current += 1;
  useRuntimeLogs();
  return null;
});

interface HarnessState {
  collectorStatus: CollectorStatus;
  aiEngineStatus: AiEngineStatus;
  analysisValue: AnalysisStatusContextValue;
  logsValue: RuntimeLogsContextValue;
}

type HarnessUpdater = (partial: Partial<HarnessState>) => void;

let harnessUpdate: HarnessUpdater | null = null;

const baseAnalysisValue: AnalysisStatusContextValue = {
  queueStatus: null,
  analysisPaused: false,
  activeAnalysis: null,
  activeAnalyses: new Map(),
  lastAnalysisEvent: null,
  lastAccountStatusChange: null,
  lastMessagesUpdate: null,
  requestQueueStatusRefresh: () => {},
};

const baseLogsValue: RuntimeLogsContextValue = {
  logs: [],
  totalLogCount: 0,
  hasMoreLogs: false,
  logsLoading: false,
  logsLoadingMore: false,
  logLoadError: null,
  clearLogs: () => {},
  refreshLogs: async () => {},
  loadMoreLogs: async () => {},
};

const mockRefresh = () => {};

function TestHarness() {
  const [state, setState] = useState<HarnessState>({
    collectorStatus: "stopped",
    aiEngineStatus: "unknown",
    analysisValue: baseAnalysisValue,
    logsValue: baseLogsValue,
  });

  harnessUpdate = useCallback((partial: Partial<HarnessState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  return createElement(
    CollectorStatusProvider,
    {
      collectorStatus: state.collectorStatus,
      aiEngineStatus: state.aiEngineStatus,
      requestAiStatusRefresh: mockRefresh,
    },
    createElement(
      AnalysisStatusProvider,
      { value: state.analysisValue },
      createElement(
        RuntimeLogsContext.Provider,
        { value: state.logsValue },
        createElement(CollectorConsumer),
        createElement(AnalysisConsumer),
        createElement(LogsConsumer),
      ),
    ),
  );
}

describe("Context splitting — render isolation", () => {
  it("updating CollectorStatus does not re-render AnalysisStatus or RuntimeLogs consumers", () => {
    collectorRenderCount.current = 0;
    analysisRenderCount.current = 0;
    logsRenderCount.current = 0;
    harnessUpdate = null;

    const container = document.createElement("div");
    let root: Root | null = null;

    act(() => {
      root = createRoot(container);
      root.render(createElement(TestHarness));
    });

    const analysisAfterMount = analysisRenderCount.current;
    const logsAfterMount = logsRenderCount.current;

    act(() => {
      harnessUpdate!({ collectorStatus: "running", aiEngineStatus: "available" });
    });

    expect(analysisRenderCount.current).toBe(analysisAfterMount);
    expect(logsRenderCount.current).toBe(logsAfterMount);

    act(() => {
      root!.unmount();
    });
  });

  it("updating AnalysisStatus does not re-render CollectorStatus or RuntimeLogs consumers", () => {
    collectorRenderCount.current = 0;
    analysisRenderCount.current = 0;
    logsRenderCount.current = 0;
    harnessUpdate = null;

    const container = document.createElement("div");
    let root: Root | null = null;

    act(() => {
      root = createRoot(container);
      root.render(createElement(TestHarness));
    });

    const collectorAfterMount = collectorRenderCount.current;
    const logsAfterMount = logsRenderCount.current;

    act(() => {
      harnessUpdate!({
        analysisValue: { ...baseAnalysisValue, analysisPaused: true },
      });
    });

    expect(collectorRenderCount.current).toBe(collectorAfterMount);
    expect(logsRenderCount.current).toBe(logsAfterMount);

    act(() => {
      root!.unmount();
    });
  });

  it("updating RuntimeLogs does not re-render CollectorStatus or AnalysisStatus consumers", () => {
    collectorRenderCount.current = 0;
    analysisRenderCount.current = 0;
    logsRenderCount.current = 0;
    harnessUpdate = null;

    const container = document.createElement("div");
    let root: Root | null = null;

    act(() => {
      root = createRoot(container);
      root.render(createElement(TestHarness));
    });

    const collectorAfterMount = collectorRenderCount.current;
    const analysisAfterMount = analysisRenderCount.current;

    act(() => {
      harnessUpdate!({
        logsValue: { ...baseLogsValue, totalLogCount: 42, hasMoreLogs: true },
      });
    });

    expect(collectorRenderCount.current).toBe(collectorAfterMount);
    expect(analysisRenderCount.current).toBe(analysisAfterMount);

    act(() => {
      root!.unmount();
    });
  });
});

describe("Context splitting — hook outside provider throws", () => {
  function expectHookThrows(
    renderFn: () => void,
    expectedFragments: string[],
  ) {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    let thrownError: Error | null = null;

    try {
      act(renderFn);
    } catch (e) {
      thrownError = e as Error;
    }

    expect(thrownError).not.toBeNull();
    for (const fragment of expectedFragments) {
      expect(thrownError!.message).toContain(fragment);
    }
    consoleError.mockRestore();
  }

  it("useCollectorStatus throws descriptive error outside provider", () => {
    const container = document.createElement("div");
    let root: Root | null = null;

    expectHookThrows(
      () => {
        root = createRoot(container);
        root.render(
          createElement(function TestConsumer() {
            useCollectorStatus();
            return null;
          }),
        );
      },
      ["useCollectorStatus", "CollectorStatusProvider"],
    );

    if (root) act(() => root!.unmount());
  });

  it("useAnalysisStatus throws descriptive error outside provider", () => {
    const container = document.createElement("div");
    let root: Root | null = null;

    expectHookThrows(
      () => {
        root = createRoot(container);
        root.render(
          createElement(function TestConsumer() {
            useAnalysisStatus();
            return null;
          }),
        );
      },
      ["useAnalysisStatus", "AnalysisStatusProvider"],
    );

    if (root) act(() => root!.unmount());
  });

  it("useRuntimeLogs throws descriptive error outside provider", () => {
    const container = document.createElement("div");
    let root: Root | null = null;

    expectHookThrows(
      () => {
        root = createRoot(container);
        root.render(
          createElement(function TestConsumer() {
            useRuntimeLogs();
            return null;
          }),
        );
      },
      ["useRuntimeLogs", "RuntimeLogsProvider"],
    );

    if (root) act(() => root!.unmount());
  });
});
