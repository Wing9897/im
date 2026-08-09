import { describe, it, expect, beforeEach } from "vitest";
import i18n from "../../i18n";
import { setAppLocale } from "../../i18n/locale";
import type { ActiveAnalysisState } from "../../types";
import { buildSystemStatus } from "./buildSystemStatus";

function analyses(
  ...items: ActiveAnalysisState[]
): Map<string, ActiveAnalysisState> {
  return new Map(items.map((item) => [item.batchId, item]));
}

describe("buildSystemStatus", () => {
  beforeEach(async () => {
    setAppLocale("zh-Hant");
    await i18n.changeLanguage("zh-Hant");
  });

  it("shows analysis when a batch is active", () => {
    const view = buildSystemStatus({
      collectorStatus: "running",
      aiEngineStatus: "available",
      analysisPaused: false,
      activeAnalyses: analyses({
        taskName: "熱門話題",
        messageCount: 50,
        taskId: "t1",
        batchId: "b1",
        startedAt: "2026-07-03T00:00:00Z",
      }),
    });
    expect(view.label).toContain("分析中");
    expect(view.label).toContain("熱門話題");
    expect(view.label).not.toContain("×");
    expect(view.pulse).toBe(true);
    expect(view.color).toBe("var(--info)");
  });

  it("shows concurrent count when multiple batches are active", () => {
    const view = buildSystemStatus({
      collectorStatus: "running",
      aiEngineStatus: "available",
      analysisPaused: false,
      activeAnalyses: analyses(
        {
          taskName: "熱門話題",
          messageCount: 50,
          taskId: "t1",
          batchId: "b1",
          startedAt: "2026-07-03T00:00:00Z",
        },
        {
          taskName: "地震監控",
          messageCount: 12,
          taskId: "t2",
          batchId: "b2",
          startedAt: "2026-07-03T00:01:00Z",
        },
      ),
    });
    expect(view.label).toContain("熱門話題");
    expect(view.label).toContain("×2");
    expect(view.title).toContain("2");
    expect(view.pulse).toBe(true);
  });

  it("shows collector-down with analysis-still-active copy when not paused", () => {
    const view = buildSystemStatus({
      collectorStatus: "stopped",
      aiEngineStatus: "available",
      analysisPaused: false,
      activeAnalyses: new Map(),
    });
    expect(view.label).toBe("收集器已停");
    expect(view.title).toBe("收集器已停止 · AI 分析仍可運行");
    expect(view.color).toBe("var(--error)");
  });

  it("shows healthy system when collector and AI are ok", () => {
    const view = buildSystemStatus({
      collectorStatus: "running",
      aiEngineStatus: "available",
      analysisPaused: false,
      activeAnalyses: new Map(),
    });
    expect(view.label).toBe("系統正常");
    expect(view.color).toBe("var(--success)");
  });

  it("shows paused analysis when scheduler is paused", () => {
    const view = buildSystemStatus({
      collectorStatus: "running",
      aiEngineStatus: "available",
      analysisPaused: true,
      activeAnalyses: new Map(),
    });
    expect(view.label).toBe("分析已暫停");
    expect(view.title).toBe("收集器運行中 · AI 分析已暫停");
    expect(view.color).toBe("var(--warning)");
  });

  it("prioritizes analysis paused over collector stopped (pill toggles analysis)", () => {
    const view = buildSystemStatus({
      collectorStatus: "stopped",
      aiEngineStatus: "available",
      analysisPaused: true,
      activeAnalyses: new Map(),
    });
    expect(view.label).toBe("分析已暫停");
    expect(view.title).toBe("AI 分析已暫停 · 收集器已停止");
    expect(view.color).toBe("var(--warning)");
  });

  it("keeps collector error primary because controls are disabled", () => {
    const view = buildSystemStatus({
      collectorStatus: "error",
      aiEngineStatus: "available",
      analysisPaused: true,
      activeAnalyses: new Map(),
    });
    expect(view.label).toBe("啟動失敗");
    expect(view.title).toContain("收集器啟動失敗");
  });

  it("uses collector-down AI unavailable title when collector is stopped", () => {
    const view = buildSystemStatus({
      collectorStatus: "stopped",
      aiEngineStatus: "unavailable",
      analysisPaused: false,
      activeAnalyses: new Map(),
    });
    expect(view.label).toBe("AI 無法連線");
    expect(view.title).toContain("收集器已停止，且 AI 引擎無法連線");
    expect(view.title).toContain("AI 設定");
  });

  it("shows collector transition states without claiming a stable stop", () => {
    const view = buildSystemStatus({
      collectorStatus: "restarting",
      aiEngineStatus: "available",
      analysisPaused: true,
      activeAnalyses: new Map(),
    });
    expect(view.label).toBe("重啟中…");
    expect(view.title).toContain("收集器重啟中");
    expect(view.title).not.toContain("收集器已停止");
  });
});
