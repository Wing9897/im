import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { ensureZhHantLocale, wrapWithI18n } from "../test/i18nHarness";

const collectorState = vi.hoisted(() => ({
  collectorStatus: "stopped" as "stopped" | "running" | "error",
  aiEngineStatus: "available" as const,
}));

const analysisState = vi.hoisted(() => ({
  analysisPaused: true,
  queueStatus: { analysisPaused: true, pendingCount: 0, processingBatches: [] as [] },
}));

vi.mock("../context/CollectorStatusContext", () => ({
  useCollectorStatus: () => ({
    collectorStatus: collectorState.collectorStatus,
    aiEngineStatus: collectorState.aiEngineStatus,
    requestAiStatusRefresh: () => {},
  }),
}));

vi.mock("../context/AnalysisStatusContext", () => ({
  useAnalysisStatus: () => ({
    analysisPaused: analysisState.analysisPaused,
    queueStatus: analysisState.queueStatus,
    activeAnalyses: new Map(),
    lastAnalysisEvent: null,
    lastSourceStatusChange: null,
    lastMessagesUpdate: null,
    requestQueueStatusRefresh: () => {},
  }),
}));

vi.mock("../context/ToastContext", async () =>
  (await import("../test/context-mocks")).toastContextModuleMock());

vi.mock("../api/system", () => ({
  emergencyAbortAnalysis: vi.fn(async () => {}),
  setAnalysisPaused: vi.fn(async () => {}),
}));

const { TopBarStatusActions } = await import("./AppTopBar/TopBarStatusActions");

describe("App shell status integration", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(async () => {
    await ensureZhHantLocale();
    collectorState.collectorStatus = "stopped";
    collectorState.aiEngineStatus = "available";
    analysisState.analysisPaused = true;
    analysisState.queueStatus = { analysisPaused: true, pendingCount: 0, processingBatches: [] };
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root!.unmount();
      });
    }
    root = null;
    container.remove();
  });

  it("exposes pause/resume on the top-bar status pill without task-page toolbar icons", () => {
    act(() => {
      root = createRoot(container);
      root.render(
        wrapWithI18n(createElement(MemoryRouter, null, createElement(TopBarStatusActions))),
      );
    });

    const topBarPill = container.querySelector("[data-testid='system-status-pill']");
    // Collector stopped + analysis paused → show analysis (what click toggles), not bare collector stop.
    expect(topBarPill?.textContent).toContain("分析已暫停");
    expect(topBarPill?.getAttribute("aria-label")).toContain("點擊繼續分析");
    expect(topBarPill?.tagName).toBe("BUTTON");
    expect(container.querySelector("[data-testid='pause-resume-button']")).toBeNull();
    expect(container.querySelector("[data-testid='analysis-control-toolbar']")).toBeNull();
  });
});
