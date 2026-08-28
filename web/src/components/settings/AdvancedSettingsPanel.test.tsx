import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import i18n from "../../i18n";
import { AdvancedSettingsPanel } from "./AdvancedSettingsPanel";

beforeEach(async () => {
  await i18n.changeLanguage("zh-Hant");
});

describe("AdvancedSettingsPanel", () => {
  function renderPanel(
    container: HTMLElement,
    overrides: Partial<Parameters<typeof AdvancedSettingsPanel>[0]> = {},
  ) {
    const defaults = {
      analysisMaxTotalChars: "100000",
      analysisMaxEstimatedInputTokens: "8000",
      maxConcurrentBatches: "1",
      maxBatchRetries: "3",
      preferLocalConcurrencyHint: true,
      onAnalysisMaxTotalCharsChange: vi.fn(),
      onAnalysisMaxEstimatedInputTokensChange: vi.fn(),
      onMaxConcurrentBatchesChange: vi.fn(),
      onMaxBatchRetriesChange: vi.fn(),
    };
    const props = { ...defaults, ...overrides };
    act(() => {
      createRoot(container).render(createElement(AdvancedSettingsPanel, props));
    });
    return props;
  }

  function expandSection(container: HTMLElement, title: string) {
    const toggle = Array.from(container.querySelectorAll("button")).find(
      (btn) =>
        btn.getAttribute("aria-expanded") === "false" &&
        btn.closest("div")?.textContent?.includes(title),
    );
    expect(toggle).toBeTruthy();
    act(() => {
      toggle!.click();
    });
  }

  it("renders two collapsed advanced section headers", () => {
    const container = document.createElement("div");
    renderPanel(container);
    expect(container.textContent).toContain("批次與重試");
    expect(container.textContent).toContain("內容上限");
    expect(container.textContent).not.toContain("除錯");
    expect(container.textContent).not.toContain("AI 生成超時（秒）");
    expect(container.textContent).not.toContain("全域每批上限");
    // nested inside SettingsContentCard — no second SurfaceCard frost slab
    expect(container.querySelector(".im-material-panel")).toBeNull();
  });

  it("shows batch fields when 批次與重試 is expanded", () => {
    const container = document.createElement("div");
    renderPanel(container);
    expandSection(container, "批次與重試");
    expect(container.textContent).not.toContain("AI 生成超時（秒）");
    expect(container.textContent).toContain("批次最大重試次數");
    expect(container.textContent).toContain("最大並行分析批次數");
    expect(container.textContent).not.toContain("全域每批上限");
  });

  it("shows content limit fields when 內容上限 is expanded", () => {
    const container = document.createElement("div");
    renderPanel(container);
    expandSection(container, "內容上限");
    expect(container.textContent).toContain(i18n.t("settings:analysis.advanced.maxCharsLabel"));
    expect(container.textContent).toContain(i18n.t("settings:analysis.advanced.maxTokensLabel"));
  });

  it("calls onMaxBatchRetriesChange when retries input changes", () => {
    const container = document.createElement("div");
    const props = renderPanel(container);
    expandSection(container, "批次與重試");
    const inputs = container.querySelectorAll<HTMLInputElement>("input[type='number']");
    const retriesInput = inputs[0];
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!;
    act(() => {
      nativeInputValueSetter.call(retriesInput, "5");
      retriesInput.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(props.onMaxBatchRetriesChange).toHaveBeenCalledWith("5");
  });
});
