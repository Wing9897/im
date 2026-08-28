/**
 * Unit tests for AnalysisSchedulingDialog (global scheduling on the Tasks page).
 *
 * Verifies:
 * - No 四模式 preset cards / 策略模式 radio group
 * - Common fields always visible (trigger threshold, batch limit, evidence style, auto-pause)
 * - Advanced sections collapsed by default: retries, concurrent batches, char/token caps
 * - LLM generation timeout is not in this dialog (it lives on AI settings)
 * - Loading state when settings are not yet available
 * - Load failure shows ErrorRetryBanner (not a stuck spinner)
 * - Batch overlap lives on the event task form only (not global scheduling)
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n";

const mockSettingsObject = vi.hoisted(() =>
  vi.fn((): {
    analysisBatchMessageLimit: string;
    analysisMaxTotalChars: string;
    analysisMaxEstimatedInputTokens: string;
    analysisTraceVerbose: boolean;
    llmGenerationTimeout: string;
    maxConcurrentBatches: string;
    maxBatchRetries: string;
    analysisStrategyMode: string;
    analysisTriggerThreshold: string;
    autoPauseOnRetriesExhausted: boolean;
  } | null => ({
    analysisBatchMessageLimit: "50",
    analysisMaxTotalChars: "100000",
    analysisMaxEstimatedInputTokens: "8000",
    analysisTraceVerbose: false,
    llmGenerationTimeout: "120",
    maxConcurrentBatches: "1",
    maxBatchRetries: "3",
    analysisStrategyMode: "balanced",
    analysisTriggerThreshold: "50",
    autoPauseOnRetriesExhausted: true,
  })),
);

const mockPageState = vi.hoisted(() => ({
  settingsInitialLoading: false,
  error: null as string | null,
  reloadSettings: vi.fn(async () => undefined),
}));

vi.mock("./useAnalysisSchedulingForm", () => ({
  useAnalysisSchedulingForm: () => ({
    settingsObject: mockSettingsObject(),
    settingsInitialLoading: mockPageState.settingsInitialLoading,
    error: mockPageState.error,
    saving: false,
    saveSuccess: false,
    handleSettingChange: vi.fn(),
    handleSave: vi.fn(),
    reloadSettings: mockPageState.reloadSettings,
    evidenceStyle: "balanced",
    settings: null,
    savedSnapshot: null,
    showConcurrentBatchesWarning: false,
    confirmConcurrentBatchesSave: vi.fn(),
    cancelConcurrentBatchesSave: vi.fn(),
  }),
}));

vi.mock("../../hooks/useFocusTrap", () => ({
  useFocusTrap: () => ({ current: null }),
}));

import { AnalysisSchedulingDialog } from "./AnalysisSchedulingDialog";

describe("AnalysisSchedulingDialog", () => {
  let root: Root | null = null;
  let host: HTMLDivElement | null = null;

  beforeEach(async () => {
    await i18n.changeLanguage("zh-Hant");
    mockPageState.settingsInitialLoading = false;
    mockPageState.error = null;
    mockPageState.reloadSettings.mockReset();
    mockSettingsObject.mockReturnValue({
      analysisBatchMessageLimit: "50",
      analysisMaxTotalChars: "100000",
      analysisMaxEstimatedInputTokens: "8000",
      analysisTraceVerbose: false,
      llmGenerationTimeout: "120",
      maxConcurrentBatches: "1",
      maxBatchRetries: "3",
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
    host?.remove();
    host = null;
  });

  function renderDialog() {
    host = document.createElement("div");
    document.body.appendChild(host);
    act(() => {
      root = createRoot(host!);
      root.render(createElement(AnalysisSchedulingDialog, { open: true, onClose: vi.fn() }));
    });
  }

  it("does not render a 分析觸發模式 section", () => {
    renderDialog();
    expect(document.body.textContent).not.toContain("分析觸發模式");
  });

  it("does not render strategy preset selector cards", () => {
    renderDialog();
    expect(document.body.querySelector('[role="radiogroup"]')).toBeNull();
    expect(document.body.textContent).not.toContain("策略模式");
    expect(document.body.textContent).not.toContain("保守模式");
    expect(document.body.textContent).not.toContain("自訂模式");
  });

  it("renders common fields expanded including evidence style", () => {
    renderDialog();

    expect(document.body.textContent).not.toContain("時空提取");

    const triggerInput = document.body.querySelector<HTMLInputElement>(
      'input[aria-label="觸發門檻（訊息數）"]',
    );
    expect(triggerInput).toBeTruthy();
    expect(triggerInput!.value).toBe("50");

    const batchLimitInput = document.body.querySelector<HTMLInputElement>(
      'input[aria-label="每批上限（訊息數）"]',
    );
    expect(batchLimitInput).toBeTruthy();
    expect(batchLimitInput!.value).toBe("50");

    expect(document.body.textContent).toContain("證據風格");
    expect(document.body.textContent).not.toContain("時空提取");
    expect(document.body.querySelector("#spatiotemporal-mode")).toBeNull();
    expect(document.body.textContent).not.toContain("批次重疊");
    expect(document.body.textContent).toContain("重試用盡自動暫停");
    expect(document.body.querySelector('[data-testid="analysis-auto-pause"]')?.getAttribute("role")).toBe(
      "switch",
    );
    expect(
      document.body.querySelector('[data-testid="analysis-auto-pause"]')?.getAttribute("aria-checked"),
    ).toBe("true");
    expect(document.body.textContent).not.toContain("已啟用");
    expect(document.body.textContent).not.toContain("任務可另行覆寫");

    const evidenceTrigger = document.body.querySelector<HTMLButtonElement>("#analysis-evidence-style");
    expect(evidenceTrigger).toBeTruthy();
    expect(evidenceTrigger!.textContent).toContain("均衡");
    act(() => {
      evidenceTrigger!.click();
    });
    expect(document.body.querySelectorAll('[role="option"]').length).toBe(3);
  });

  it("renders advanced collapsible section headers collapsed by default without timeout", () => {
    renderDialog();

    expect(document.body.textContent).toContain("批次與重試");
    expect(document.body.textContent).toContain("內容上限");
    expect(document.body.textContent).not.toContain("AI 生成超時（秒）");
    expect(document.body.querySelector("#llm-generation-timeout")).toBeNull();

    const expandButtons = Array.from(document.body.querySelectorAll("button")).filter(
      (btn) => btn.getAttribute("aria-expanded") === "false",
    );
    act(() => {
      for (const btn of expandButtons) btn.click();
    });

    expect(document.body.textContent).toContain("批次最大重試次數");
    expect(document.body.textContent).toContain("最大並行分析批次數");
    expect(document.body.textContent).toContain("單批分析最大字元數");
    expect(document.body.textContent).toContain("全域輸入 Token 上限");

    const retries = document.body.querySelector<HTMLInputElement>("#max-batch-retries");
    const concurrent = document.body.querySelector<HTMLInputElement>("#max-concurrent-batches");
    const maxChars = document.body.querySelector<HTMLInputElement>("#analysis-max-total-chars");
    const maxTokens = document.body.querySelector<HTMLInputElement>(
      "#analysis-max-estimated-input-tokens",
    );
    expect(retries?.value).toBe("3");
    expect(concurrent?.value).toBe("1");
    expect(maxChars?.value).toBe("100000");
    expect(maxTokens?.value).toBe("8000");
    expect(document.body.querySelector("#llm-generation-timeout")).toBeNull();
    expect(document.body.textContent).not.toContain("AI 生成超時（秒）");
  });

  it("renders save button", () => {
    renderDialog();
    expect(document.body.textContent).toContain("儲存分析調度");
  });

  it("renders loading spinner when settings are still loading", () => {
    mockSettingsObject.mockReturnValue(null);
    mockPageState.settingsInitialLoading = true;

    renderDialog();

    expect(document.body.textContent).toContain("載入分析調度設定中");
  });

  it("shows ErrorRetryBanner on load failure instead of a spinner", async () => {
    mockSettingsObject.mockReturnValue(null);
    mockPageState.settingsInitialLoading = false;
    mockPageState.error = "網路錯誤";

    renderDialog();

    expect(document.body.querySelector('[role="alert"]')?.textContent).toContain("網路錯誤");
    expect(document.body.textContent).not.toContain("載入分析調度設定中");
    const retry = Array.from(document.body.querySelectorAll("button")).find(
      (btn) => btn.textContent === "重試",
    );
    expect(retry).toBeTruthy();
    await act(async () => {
      retry!.click();
    });
    expect(mockPageState.reloadSettings).toHaveBeenCalledOnce();
  });
});
