import { describe, it, expect, beforeEach } from "vitest";
import i18n from "../../i18n";
import { setAppLocale } from "../../i18n/locale";
import { buildSystemStatus } from "./buildSystemStatus";
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
      activeAnalysis: {
        taskName: "熱門話題",
        messageCount: 50,
        taskId: "t1",
        batchId: "b1",
        startedAt: "2026-07-03T00:00:00Z",
      },
    });
    expect(view.label).toContain("分析中");
    expect(view.label).toContain("熱門話題");
    expect(view.pulse).toBe(true);
    expect(view.color).toBe("var(--info)");
  });

  it("shows collector state instead of duplicate offline labels", () => {
    const view = buildSystemStatus({
      collectorStatus: "stopped",
      aiEngineStatus: "available",
      analysisPaused: false,
      activeAnalysis: null,
    });
    expect(view.label).toBe("已停止");
    expect(view.title).toContain("收集器已停止");
  });

  it("shows healthy system when collector and AI are ok", () => {
    const view = buildSystemStatus({
      collectorStatus: "running",
      aiEngineStatus: "available",
      analysisPaused: false,
      activeAnalysis: null,
    });
    expect(view.label).toBe("系統正常");
    expect(view.color).toBe("var(--success)");
  });

  it("shows paused analysis when scheduler is paused", () => {
    const view = buildSystemStatus({
      collectorStatus: "running",
      aiEngineStatus: "available",
      analysisPaused: true,
      activeAnalysis: null,
    });
    expect(view.label).toBe("分析已暫停");
    expect(view.color).toBe("var(--warning)");
  });

  it("prioritizes collector stopped over analysis paused", () => {
    const view = buildSystemStatus({
      collectorStatus: "stopped",
      aiEngineStatus: "available",
      analysisPaused: true,
      activeAnalysis: null,
    });
    expect(view.label).toBe("已停止");
    expect(view.title).toContain("收集器已停止");
  });
});
