import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import i18n from "../../i18n";
import { AnalysisDebugPanel } from "./AnalysisDebugPanel";

beforeEach(async () => {
  await i18n.changeLanguage("zh-Hant");
});

describe("AnalysisDebugPanel", () => {
  function renderPanel(
    container: HTMLElement,
    overrides: Partial<Parameters<typeof AnalysisDebugPanel>[0]> = {},
  ) {
    const defaults = {
      intelligenceRulesVersion: "v2",
      analysisTraceVerbose: false,
      onIntelligenceRulesVersionChange: vi.fn(),
      onAnalysisTraceVerboseChange: vi.fn(),
      defaultOpen: true,
    };
    const props = { ...defaults, ...overrides };
    act(() => {
      createRoot(container).render(createElement(AnalysisDebugPanel, props));
    });
    return props;
  }

  it("shows updated debug labels and help", () => {
    const container = document.createElement("div");
    renderPanel(container);
    expect(container.textContent).toContain("除錯與診斷");
    expect(container.textContent).toContain("分析規則版本標記");
    expect(container.textContent).toContain("伺服器分析 Trace");
    expect(container.textContent).toContain("不會切換證據風格");
    expect(container.textContent).toContain("不是設定→系統日誌頁");
    expect(container.textContent).not.toContain("記錄完整 request/response");
  });

  it("notifies when the trace checkbox changes", () => {
    const container = document.createElement("div");
    const props = renderPanel(container);
    const checkbox = container.querySelector<HTMLInputElement>("#analysis-trace-verbose")!;
    act(() => {
      checkbox.click();
    });
    expect(props.onAnalysisTraceVerboseChange).toHaveBeenCalledWith(true);
  });
});
