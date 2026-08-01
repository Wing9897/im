/**
 * Integration tests for control flow wiring.
 *
 * Tests the full cycle:
 * 1. Pause flow: handleAnalysisPausedChange → setAnalysisPaused API → UI state update
 * 2. Abort flow: handleEmergencyAbort → emergencyAbortAnalysis API → state update
 * 3. Interlock: start pause → attempt abort → verify rejection
 *
 * **Validates: Requirements 4.4, 5.1, 5.2, 5.3**
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement, useState, act } from "react";
import { createRoot, type Root } from "react-dom/client";

// ── Mock setup ──────────────────────────────────────────────────────────────

let setAnalysisPausedResolvers: Array<{ resolve: () => void; reject: (e: Error) => void }> = [];

const mockSetAnalysisPaused = vi.fn(
  () =>
    new Promise<void>((resolve, reject) => {
      setAnalysisPausedResolvers.push({ resolve, reject });
    }),
);

// Track emergencyAbortAnalysis calls and control resolution
let emergencyAbortResolvers: Array<{ resolve: () => void; reject: (e: Error) => void }> = [];

const mockEmergencyAbortAnalysis = vi.fn(
  () =>
    new Promise<void>((resolve, reject) => {
      emergencyAbortResolvers.push({ resolve, reject });
    }),
);

vi.mock("../../api/system", () => ({
  emergencyAbortAnalysis: () => mockEmergencyAbortAnalysis(),
  setAnalysisPaused: (...args: unknown[]) => mockSetAnalysisPaused(...args),
}));

vi.mock("../../context/ToastContext", async () =>
  (await import("../../test/context-mocks")).toastContextModuleMock());

vi.mock("../../hooks/useTaskAnalysisStats", async () =>
  (await import("../../test/task-analysis-stats-mock")).taskAnalysisStatsModuleMock());

vi.mock("../../utils/errors", () => ({
  toErrorMessage: (e: unknown) => (e instanceof Error ? e.message : String(e)),
  handleCommandError: (e: unknown) => {
    return e instanceof Error ? e.message : String(e);
  },
}));

vi.mock("../../utils/logger", () => ({
  logWarn: vi.fn(),
}));

// Import real context providers
import {
  AnalysisStatusProvider,
  type AnalysisStatusContextValue,
} from "../../context/AnalysisStatusContext";
import { CollectorStatusProvider } from "../../context/CollectorStatusContext";

// Import the hook under test (after mocks are set up)
const { useAnalysisControls } = await import("./useAnalysisControls");

// ── Test Harness ────────────────────────────────────────────────────────────

interface HookResult {
  handleAnalysisPausedChange: (paused: boolean) => Promise<void>;
  handleEmergencyAbort: () => Promise<void>;
  updatingAnalysisPaused: boolean;
  abortingAnalysis: boolean;
  statusLabel: string;
}

let latestHookResult: HookResult | null = null;

function HookConsumer() {
  const result = useAnalysisControls();
  latestHookResult = result as unknown as HookResult;
  return null;
}

const stableRequestQueueStatusRefresh = vi.fn();
const stableRequestAiStatusRefresh = vi.fn();

function TestHarness({ analysisPaused = false }: { analysisPaused?: boolean }) {
  const analysisValue: AnalysisStatusContextValue = {
    queueStatus: { analysisPaused } as any,
    analysisPaused,
    activeAnalysis: null,
    activeAnalyses: new Map(),
    lastAnalysisEvent: null,
    lastAccountStatusChange: null,
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
    createElement(
      AnalysisStatusProvider,
      { value: analysisValue },
      createElement(HookConsumer),
    ),
  );
}

// ── Integration Tests ───────────────────────────────────────────────────────

describe("Control flow integration tests", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    setAnalysisPausedResolvers = [];
    emergencyAbortResolvers = [];
    mockSetAnalysisPaused.mockClear();
    mockEmergencyAbortAnalysis.mockClear();
    stableRequestQueueStatusRefresh.mockClear();
    stableRequestAiStatusRefresh.mockClear();
    latestHookResult = null;

    container = document.createElement("div");
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    vi.useRealTimers();
  });

  // ─── Pause Flow ─────────────────────────────────────────────────────────

  describe("Pause flow: handleAnalysisPausedChange → API call → UI state update", () => {
    /**
     * Validates: Requirement 4.4, 5.1
     *
     * Full pause cycle:
     * 1. Call handleAnalysisPausedChange(true)
     * 2. Verify setAnalysisPaused API is called with correct payload
     * 3. Mock success (resolve the promise)
     * 4. Verify state update: updatingAnalysisPaused transitions from true → false
     */
    it("pause: calls setAnalysisPaused API and updates state on success", async () => {
      // Mount with analysis running (not paused)
      act(() => {
        root.render(createElement(TestHarness, { analysisPaused: false }));
      });
      expect(latestHookResult).not.toBeNull();
      expect(latestHookResult!.updatingAnalysisPaused).toBe(false);

      // Step 1: Trigger pause
      act(() => {
        void latestHookResult!.handleAnalysisPausedChange(true);
      });

      // Step 2: Verify API was called and state is now "updating"
      expect(mockSetAnalysisPaused).toHaveBeenCalledTimes(1);
      expect(mockSetAnalysisPaused).toHaveBeenCalledWith(true);
      expect(latestHookResult!.updatingAnalysisPaused).toBe(true);

      // Verify optimistic update applied immediately (shows "分析已暫停")
      expect(latestHookResult!.statusLabel).toBe("分析已暫停");

      // Step 3: Resolve the API call (success)
      expect(setAnalysisPausedResolvers.length).toBe(1);
      await act(async () => {
        setAnalysisPausedResolvers[0].resolve();
      });

      // Flush timers
      act(() => {
        vi.runAllTimers();
      });

      // Step 4: Verify state updated — no longer updating
      expect(latestHookResult!.updatingAnalysisPaused).toBe(false);

      // Verify queue status refresh was requested
      expect(stableRequestQueueStatusRefresh).toHaveBeenCalledWith(true);
    });

    /**
     * Validates: Requirement 5.1
     *
     * Full resume cycle:
     * 1. Start from paused state
     * 2. Call handleAnalysisPausedChange(false) to resume
     * 3. Verify setAnalysisPaused called with false
     * 4. Verify state update on success
     */
    it("resume: calls setAnalysisPaused API with false and updates state on success", async () => {
      // Mount with analysis paused
      act(() => {
        root.render(createElement(TestHarness, { analysisPaused: true }));
      });
      expect(latestHookResult!.statusLabel).toBe("分析已暫停");

      // Trigger resume
      act(() => {
        void latestHookResult!.handleAnalysisPausedChange(false);
      });

      // Verify API call
      expect(mockSetAnalysisPaused).toHaveBeenCalledTimes(1);
      expect(mockSetAnalysisPaused).toHaveBeenCalledWith(false);
      expect(latestHookResult!.updatingAnalysisPaused).toBe(true);

      // Optimistic update shows running
      expect(latestHookResult!.statusLabel).toBe("系統正常");

      // Resolve success
      await act(async () => {
        setAnalysisPausedResolvers[0].resolve();
      });

      act(() => {
        vi.runAllTimers();
      });

      expect(latestHookResult!.updatingAnalysisPaused).toBe(false);
      expect(stableRequestQueueStatusRefresh).toHaveBeenCalledWith(true);
    });
  });

  // ─── Abort Flow ─────────────────────────────────────────────────────────

  describe("Abort flow: handleEmergencyAbort → API call → state update", () => {
    /**
     * Validates: Requirement 5.2
     *
     * Full abort cycle:
     * 1. Call handleEmergencyAbort()
     * 2. Verify emergencyAbortAnalysis API is called
     * 3. Mock success (resolve the promise)
     * 4. Verify state update: abortingAnalysis transitions true → false
     * 5. Verify queue + AI status refresh requested
     */
    it("abort: calls emergencyAbortAnalysis API and updates state on success", async () => {
      // Mount with analysis running
      act(() => {
        root.render(createElement(TestHarness, { analysisPaused: false }));
      });
      expect(latestHookResult).not.toBeNull();
      expect(latestHookResult!.abortingAnalysis).toBe(false);

      // Step 1: Trigger abort
      act(() => {
        void latestHookResult!.handleEmergencyAbort();
      });

      // Step 2: Verify API was called and state is "aborting"
      expect(mockEmergencyAbortAnalysis).toHaveBeenCalledTimes(1);
      expect(latestHookResult!.abortingAnalysis).toBe(true);

      // Step 3: Resolve the API call (success)
      expect(emergencyAbortResolvers.length).toBe(1);
      await act(async () => {
        emergencyAbortResolvers[0].resolve();
      });

      // Flush
      act(() => {
        vi.runAllTimers();
      });

      // Step 4: Verify state — no longer aborting
      expect(latestHookResult!.abortingAnalysis).toBe(false);

      // Step 5: Verify both queue status and AI status refresh were requested
      expect(stableRequestQueueStatusRefresh).toHaveBeenCalledWith(true);
      expect(stableRequestAiStatusRefresh).toHaveBeenCalledWith(true);
    });

    /**
     * Validates: Requirement 5.2
     *
     * Abort flow error handling:
     * When the API call fails, state should still be cleaned up.
     */
    it("abort: clears abortingAnalysis flag on API failure", async () => {
      act(() => {
        root.render(createElement(TestHarness, { analysisPaused: false }));
      });

      // Trigger abort
      act(() => {
        void latestHookResult!.handleEmergencyAbort();
      });

      expect(latestHookResult!.abortingAnalysis).toBe(true);

      // Reject the API call
      await act(async () => {
        emergencyAbortResolvers[0].reject(new Error("Network failure"));
      });

      act(() => {
        vi.runAllTimers();
      });

      // State should be cleaned up despite failure
      expect(latestHookResult!.abortingAnalysis).toBe(false);
    });
  });

  // ─── Interlock Behavior ─────────────────────────────────────────────────

  describe("Interlock: operations reject when another is in progress", () => {
    /**
     * Validates: Requirements 4.4, 5.1, 5.2, 5.3
     *
     * Interlock test:
     * 1. Start a pause operation (sets updatingAnalysisPaused=true)
     * 2. Attempt emergency abort while pause is pending
     * 3. Verify abort is rejected (API not called)
     */
    it("rejects abort while pause operation is in progress", async () => {
      act(() => {
        root.render(createElement(TestHarness, { analysisPaused: false }));
      });

      // Start pause (leaves promise pending — updatingAnalysisPaused=true)
      act(() => {
        void latestHookResult!.handleAnalysisPausedChange(true);
      });

      expect(latestHookResult!.updatingAnalysisPaused).toBe(true);
      expect(mockSetAnalysisPaused).toHaveBeenCalledTimes(1);

      // Attempt abort while pause is in progress
      act(() => {
        void latestHookResult!.handleEmergencyAbort();
      });

      // Abort API should NOT have been called
      expect(mockEmergencyAbortAnalysis).not.toHaveBeenCalled();
      expect(latestHookResult!.abortingAnalysis).toBe(false);

      // Clean up: resolve the pending pause
      await act(async () => {
        setAnalysisPausedResolvers[0].resolve();
      });
      act(() => {
        vi.runAllTimers();
      });
    });

    /**
     * Validates: Requirements 4.4, 5.2, 5.1
     *
     * Interlock test:
     * 1. Start an abort operation (sets abortingAnalysis=true)
     * 2. Attempt pause while abort is pending
     * 3. Verify pause is rejected (API not called)
     */
    it("rejects pause while abort operation is in progress", async () => {
      act(() => {
        root.render(createElement(TestHarness, { analysisPaused: false }));
      });

      // Start abort (leaves promise pending — abortingAnalysis=true)
      act(() => {
        void latestHookResult!.handleEmergencyAbort();
      });

      expect(latestHookResult!.abortingAnalysis).toBe(true);
      expect(mockEmergencyAbortAnalysis).toHaveBeenCalledTimes(1);

      // Attempt pause while abort is in progress
      act(() => {
        void latestHookResult!.handleAnalysisPausedChange(true);
      });

      // setAnalysisPaused should NOT have been called
      expect(mockSetAnalysisPaused).not.toHaveBeenCalled();
      expect(latestHookResult!.updatingAnalysisPaused).toBe(false);

      // Clean up: resolve the pending abort
      await act(async () => {
        emergencyAbortResolvers[0].resolve();
      });
      act(() => {
        vi.runAllTimers();
      });
    });

    /**
     * Validates: Requirements 4.4, 5.1, 5.2, 5.3
     *
     * Interlock test: After one operation completes, a new operation should proceed.
     */
    it("allows new operations after previous operation completes", async () => {
      act(() => {
        root.render(createElement(TestHarness, { analysisPaused: false }));
      });

      // Start and complete a pause operation
      act(() => {
        void latestHookResult!.handleAnalysisPausedChange(true);
      });

      expect(latestHookResult!.updatingAnalysisPaused).toBe(true);

      await act(async () => {
        setAnalysisPausedResolvers[0].resolve();
      });
      act(() => {
        vi.runAllTimers();
      });

      expect(latestHookResult!.updatingAnalysisPaused).toBe(false);

      // Now abort should succeed
      act(() => {
        void latestHookResult!.handleEmergencyAbort();
      });

      expect(mockEmergencyAbortAnalysis).toHaveBeenCalledTimes(1);
      expect(latestHookResult!.abortingAnalysis).toBe(true);

      // Clean up
      await act(async () => {
        emergencyAbortResolvers[0].resolve();
      });
      act(() => {
        vi.runAllTimers();
      });
    });
  });
});
