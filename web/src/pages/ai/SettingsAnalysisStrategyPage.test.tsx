/**
 * Unit tests for SettingsAnalysisStrategyPage.
 *
 * Verifies:
 * - No 四模式 preset cards / 策略模式 radio group
 * - Common fields always visible (trigger threshold, batch limit, auto-pause)
 * - Advanced sections collapsed by default; evidence style under 常用
 * - No spatiotemporal mode selector (policy is built into the analyzer)
 * - Loading state when settings are not yet available
 * - Batch overlap lives on the event task form only (not global AI settings)
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n";

/* ------------------------------------------------------------------ */
/*  Hoisted mocks                                                      */
/* ------------------------------------------------------------------ */

const mockSettingsObject = vi.hoisted(() =>
  vi.fn((): {
    llmProvider: string;
    analysisBatchMessageLimit: string;
    analysisMaxTotalChars: string;
    analysisMaxEstimatedInputTokens: string;
    analysisTraceVerbose: boolean;
    llmGenerationTimeout: string;
    maxConcurrentBatches: string;
    maxBatchRetries: string;
    intelligenceRulesVersion: string;
    analysisStrategyMode: string;
    analysisTriggerThreshold: string;
    autoPauseOnRetriesExhausted: boolean;
  } | null => ({
    llmProvider: "ollama",
    analysisBatchMessageLimit: "50",
    analysisMaxTotalChars: "100000",
    analysisMaxEstimatedInputTokens: "8000",
    analysisTraceVerbose: false,
    llmGenerationTimeout: "120",
    maxConcurrentBatches: "1",
    maxBatchRetries: "3",
    intelligenceRulesVersion: "v2",
    analysisStrategyMode: "balanced",
    analysisTriggerThreshold: "50",
    autoPauseOnRetriesExhausted: true,
  })),
);

vi.mock("./useSettingsAnalysisStrategyPage", () => ({
  useSettingsAnalysisStrategyPage: () => ({
    settingsObject: mockSettingsObject(),
    settingsInitialLoading: mockSettingsObject() === null,
    error: null,
    saving: false,
    saveSuccess: false,
    handleSettingChange: vi.fn(),
    handleSave: vi.fn(),
    evidenceStyle: "balanced",
  }),
}));

vi.mock("../../hooks/useFocusTrap", () => ({
  useFocusTrap: () => ({ current: null }),
}));

import { SettingsAnalysisStrategyPage } from "./SettingsAnalysisStrategyPage";

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("SettingsAnalysisStrategyPage", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(async () => {
    await i18n.changeLanguage("zh-Hant");
    container = document.createElement("div");
    document.body.appendChild(container);
    mockSettingsObject.mockReturnValue({
      llmProvider: "ollama",
      analysisBatchMessageLimit: "50",
      analysisMaxTotalChars: "100000",
      analysisMaxEstimatedInputTokens: "8000",
      analysisTraceVerbose: false,
      llmGenerationTimeout: "120",
      maxConcurrentBatches: "1",
      maxBatchRetries: "3",
      intelligenceRulesVersion: "v2",
      analysisStrategyMode: "balanced",
      analysisTriggerThreshold: "50",
      autoPauseOnRetriesExhausted: true,
    });
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

  it("does not render a 分析觸發模式 section", () => {
    act(() => {
      root = createRoot(container);
      root.render(createElement(SettingsAnalysisStrategyPage));
    });

    expect(container.textContent).not.toContain("分析觸發模式");
  });

  it("does not render strategy preset selector cards", () => {
    act(() => {
      root = createRoot(container);
      root.render(createElement(SettingsAnalysisStrategyPage));
    });

    expect(container.querySelector('[role="radiogroup"]')).toBeNull();
    expect(container.textContent).not.toContain("策略模式");
    expect(container.textContent).not.toContain("保守模式");
    expect(container.textContent).not.toContain("自訂模式");
  });

  it("renders common fields expanded including evidence style", () => {
    act(() => {
      root = createRoot(container);
      root.render(createElement(SettingsAnalysisStrategyPage));
    });

    expect(container.textContent).not.toContain("時空提取");

    const triggerInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="觸發門檻（訊息數）"]',
    );
    expect(triggerInput).toBeTruthy();
    expect(triggerInput!.value).toBe("50");

    const batchLimitInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="每批上限（訊息數）"]',
    );
    expect(batchLimitInput).toBeTruthy();
    expect(batchLimitInput!.value).toBe("50");

    expect(container.textContent).toContain("證據風格");
    expect(container.textContent).not.toContain("時空提取");
    expect(container.querySelector("#spatiotemporal-mode")).toBeNull();
    expect(container.textContent).not.toContain("批次重疊");
    expect(container.textContent).toContain("重試用盡自動暫停");
    expect(container.textContent).toContain("已啟用");
    expect(container.textContent).not.toContain("任務可另行覆寫");

    const select = container.querySelector<HTMLSelectElement>("#analysis-evidence-style");
    expect(select).toBeTruthy();
    expect(select!.value).toBe("balanced");
    expect(select!.querySelectorAll("option").length).toBe(3);
  });

  it("renders advanced collapsible section headers collapsed by default", () => {
    act(() => {
      root = createRoot(container);
      root.render(createElement(SettingsAnalysisStrategyPage));
    });

    expect(container.textContent).toContain("批次與重試");
    expect(container.textContent).not.toContain("AI 生成超時（秒）");

    const expandButtons = Array.from(container.querySelectorAll("button")).filter(
      (btn) => btn.getAttribute("aria-expanded") === "false",
    );
    act(() => {
      for (const btn of expandButtons) btn.click();
    });

    expect(container.textContent).toMatch(/生成超時|重試/);
  });

  it("renders save button", () => {
    act(() => {
      root = createRoot(container);
      root.render(createElement(SettingsAnalysisStrategyPage));
    });

    expect(container.textContent).toContain("儲存分析調度");
  });

  it("renders loading spinner when settingsObject is null", () => {
    mockSettingsObject.mockReturnValue(null);

    act(() => {
      root = createRoot(container);
      root.render(createElement(SettingsAnalysisStrategyPage));
    });

    expect(container.textContent).toContain("載入分析調度設定中");
  });
});
