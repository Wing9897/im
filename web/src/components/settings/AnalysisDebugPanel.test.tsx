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
      onIntelligenceRulesVersionCommit: vi.fn(),
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
    expect(container.textContent).toContain("切換後立即生效");
    expect(container.textContent).not.toContain("記錄完整 request/response");
  });

  it("notifies when the trace switch changes", () => {
    const container = document.createElement("div");
    const props = renderPanel(container);
    const switchEl = container.querySelector<HTMLElement>('[role="switch"]')!;
    expect(switchEl.getAttribute("aria-checked")).toBe("false");
    act(() => {
      switchEl.click();
    });
    expect(props.onAnalysisTraceVerboseChange).toHaveBeenCalledWith(true);
  });

  it("commits rules version on blur", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    try {
      const props = renderPanel(container, { intelligenceRulesVersion: "v3" });
      const input = container.querySelector<HTMLInputElement>("#intelligence-rules-version")!;
      act(() => {
        input.focus();
        input.blur();
      });
      expect(props.onIntelligenceRulesVersionCommit).toHaveBeenCalledWith("v3");
    } finally {
      container.remove();
    }
  });
});
