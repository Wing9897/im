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
      analysisTraceVerbose: false,
      onAnalysisTraceVerboseChange: vi.fn(),
      defaultOpen: true,
    };
    const props = { ...defaults, ...overrides };
    act(() => {
      createRoot(container).render(createElement(AnalysisDebugPanel, props));
    });
    return props;
  }

  it("shows trace-only debug controls", () => {
    const container = document.createElement("div");
    renderPanel(container);
    expect(container.textContent).toContain("除錯與診斷");
    expect(container.textContent).toContain("伺服器分析 Trace");
    expect(container.textContent).not.toContain("分析規則版本標記");
    expect(container.textContent).toContain("設定→日誌");
    expect(container.textContent).not.toContain("已關閉");
    expect(container.textContent).not.toContain("已啟用");
  });

  it("notifies when the trace switch is toggled", () => {
    const container = document.createElement("div");
    const props = renderPanel(container);
    const toggle = container.querySelector<HTMLElement>('[data-testid="analysis-trace-verbose"]')!;
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    expect(toggle.className).not.toContain("im-surface-inset");
    expect(toggle.className).not.toContain("border-accent");
    act(() => {
      toggle.click();
    });
    expect(props.onAnalysisTraceVerboseChange).toHaveBeenCalledWith(true);
  });

  it("marks the trace tile active when verbose is on", () => {
    const container = document.createElement("div");
    renderPanel(container, { analysisTraceVerbose: true });
    const tile = container.querySelector('[data-testid="analysis-trace-verbose"]');
    expect(tile?.getAttribute("aria-checked")).toBe("true");
    expect(container.textContent).not.toContain("已啟用");
  });
});
