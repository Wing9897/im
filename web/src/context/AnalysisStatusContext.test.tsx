import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AnalysisStatusProvider,
  useAnalysisStatus,
  type AnalysisStatusContextValue,
} from "./AnalysisStatusContext";

let latestValue: AnalysisStatusContextValue | null = null;

function AnalysisStatusHarness() {
  latestValue = useAnalysisStatus();
  return null;
}

describe("AnalysisStatusContext", () => {
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
        root.render(<AnalysisStatusHarness />);
      });
    }).toThrow(
      "useAnalysisStatus must be used within a <AnalysisStatusProvider>",
    );

    expect(consoleError).toHaveBeenCalled();
  });

  it("provides analysis status values from the provider", () => {
    const mockRefresh = vi.fn();
    const mockActiveAnalyses = new Map([
      ["a1", { accountId: "a1", batchId: "b1", startedAt: Date.now() }],
    ]);

    const value: AnalysisStatusContextValue = {
      queueStatus: { pendingCount: 5, processingBatches: [], analysisPaused: false },
      analysisPaused: true,
      activeAnalysis: {
        batchId: "b1",
        messageCount: 10,
        startedAt: new Date(Date.now()).toISOString(),
      },
      activeAnalyses: mockActiveAnalyses as any,
      lastAnalysisEvent: { type: "started", payload: { taskId: "t1", taskName: "Task", batchId: "b1", messageCount: 10, estimatedTokens: 500, llmProvider: "openai", llmModel: "gpt-4" }, receivedAt: Date.now() },
      lastAccountStatusChange: { accountId: "a1", status: "connected" },
      lastMessagesUpdate: { accountId: "a1", count: 10 } as any,
      requestQueueStatusRefresh: mockRefresh,
    };

    act(() => {
      root = createRoot(container);
      root.render(
        <AnalysisStatusProvider value={value}>
          <AnalysisStatusHarness />
        </AnalysisStatusProvider>,
      );
    });

    expect(latestValue).not.toBeNull();
    expect(latestValue!.queueStatus).toEqual({
      pendingCount: 5,
      processingBatches: [],
      analysisPaused: false,
    });
    expect(latestValue!.analysisPaused).toBe(true);
    expect(latestValue!.activeAnalysis).toEqual(value.activeAnalysis);
    expect(latestValue!.activeAnalyses).toBe(mockActiveAnalyses);
    expect(latestValue!.lastAnalysisEvent).toEqual(
      expect.objectContaining({
        type: "started",
      }),
    );
    expect(latestValue!.lastAccountStatusChange).toEqual({
      accountId: "a1",
      status: "connected",
    });
    expect(latestValue!.requestQueueStatusRefresh).toBe(mockRefresh);
  });

  it("updates when provider value changes", () => {
    const mockRefresh = vi.fn();

    const initialValue: AnalysisStatusContextValue = {
      queueStatus: null,
      analysisPaused: false,
      activeAnalysis: null,
      activeAnalyses: new Map(),
      lastAnalysisEvent: null,
      lastAccountStatusChange: null,
      lastMessagesUpdate: null,
      requestQueueStatusRefresh: mockRefresh,
    };

    act(() => {
      root = createRoot(container);
      root.render(
        <AnalysisStatusProvider value={initialValue}>
          <AnalysisStatusHarness />
        </AnalysisStatusProvider>,
      );
    });

    expect(latestValue!.analysisPaused).toBe(false);
    expect(latestValue!.queueStatus).toBeNull();

    const updatedValue: AnalysisStatusContextValue = {
      ...initialValue,
      analysisPaused: true,
      queueStatus: { pendingCount: 3, processingBatches: [], analysisPaused: true },
    };

    act(() => {
      root!.render(
        <AnalysisStatusProvider value={updatedValue}>
          <AnalysisStatusHarness />
        </AnalysisStatusProvider>,
      );
    });

    expect(latestValue!.analysisPaused).toBe(true);
    expect(latestValue!.queueStatus).toEqual({
      pendingCount: 3,
      processingBatches: [],
      analysisPaused: true,
    });
  });
});
