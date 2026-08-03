import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import i18n from "../../i18n";
import { AdvancedSettingsPanel } from "./AdvancedSettingsPanel";
import { LlmSettingsPanel } from "./LlmSettingsPanel";
import { RuntimeResetPanel } from "./RuntimeResetPanel";

beforeEach(async () => {
  await i18n.changeLanguage("zh-Hant");
});

// --- AdvancedSettingsPanel ---

describe("AdvancedSettingsPanel", () => {
  function renderPanel(container: HTMLElement, overrides: Partial<Parameters<typeof AdvancedSettingsPanel>[0]> = {}) {
    const defaults = {
      analysisMaxTotalChars: "100000",
      analysisMaxEstimatedInputTokens: "8000",
      llmGenerationTimeout: "120",
      maxConcurrentBatches: "1",
      maxBatchRetries: "3",
      llmProvider: "ollama",
      onAnalysisMaxTotalCharsChange: vi.fn(),
      onAnalysisMaxEstimatedInputTokensChange: vi.fn(),
      onLlmGenerationTimeoutChange: vi.fn(),
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
  });

  it("shows batch fields when 批次與重試 is expanded", () => {
    const container = document.createElement("div");
    renderPanel(container);
    expandSection(container, "批次與重試");
    expect(container.textContent).toContain("AI 生成超時（秒）");
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

  it("calls onLlmGenerationTimeoutChange when timeout input changes", () => {
    const container = document.createElement("div");
    const props = renderPanel(container);
    expandSection(container, "批次與重試");
    const inputs = container.querySelectorAll<HTMLInputElement>("input[type='number']");
    const timeoutInput = inputs[0];
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    act(() => {
      nativeInputValueSetter.call(timeoutInput, "180");
      timeoutInput.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(props.onLlmGenerationTimeoutChange).toHaveBeenCalledWith("180");
  });

});

// --- LlmSettingsPanel ---

describe("LlmSettingsPanel", () => {
  function renderPanel(container: HTMLElement, overrides: Partial<Parameters<typeof LlmSettingsPanel>[0]> = {}) {
    const defaults = {
      llmProvider: "ollama" as const,
      llmBaseUrl: "http://localhost:11434",
      llmModel: "qwen3:4b",
      llmApiKey: "",
      openaiJsonMode: "json_schema",
      ollamaThinkingEnabled: false,
      onLlmProviderChange: vi.fn(),
      onLlmBaseUrlChange: vi.fn(),
      onLlmModelChange: vi.fn(),
      onLlmApiKeyChange: vi.fn(),
      onOpenaiJsonModeChange: vi.fn(),
      onOllamaThinkingEnabledChange: vi.fn(),
    };
    const props = { ...defaults, ...overrides };
    act(() => {
      createRoot(container).render(createElement(LlmSettingsPanel, props));
    });
    return props;
  }

  it("renders provider tiles and input fields", () => {
    const container = document.createElement("div");
    renderPanel(container);
    expect(container.textContent).toContain("Ollama URL");
    expect(container.textContent).toContain("Ollama 模型");
    expect(container.textContent).toContain("API Key");
    expect(container.textContent).not.toContain("掃描間隔（秒）");
  });

  it("shows provider-specific labels for openai_compatible", () => {
    const container = document.createElement("div");
    renderPanel(container, { llmProvider: "openai_compatible" });
    expect(container.textContent).toContain("OpenAI 相容 API URL");
    expect(container.textContent).toContain("模型名稱");
  });

  it("calls onLlmProviderChange when a provider tile is clicked", () => {
    const container = document.createElement("div");
    const props = renderPanel(container);
    const geminiTile = Array.from(
      container.querySelectorAll("button[aria-pressed]"),
    ).find((btn) => btn.textContent?.includes("Gemini"));
    expect(geminiTile).toBeTruthy();
    act(() => {
      geminiTile!.click();
    });
    expect(props.onLlmProviderChange).toHaveBeenCalledWith("gemini_compatible");
  });

  it("calls onLlmBaseUrlChange when base URL input changes", () => {
    const container = document.createElement("div");
    const props = renderPanel(container);
    // Find the input after "Ollama URL" label — it's the first text input
    const inputs = container.querySelectorAll<HTMLInputElement>("input:not([type='number']):not([type='password'])");
    const baseUrlInput = inputs[0];
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    act(() => {
      nativeInputValueSetter.call(baseUrlInput, "http://new-url:11434");
      baseUrlInput.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(props.onLlmBaseUrlChange).toHaveBeenCalledWith("http://new-url:11434");
  });

  it("renders thinking checkbox for ollama provider", () => {
    const container = document.createElement("div");
    renderPanel(container);
    expect(container.textContent).toContain("Thinking 模式");
    expect(container.querySelector("#ollama-thinking-enabled")).toBeTruthy();
  });

  it("does not render scan interval field", () => {
    const container = document.createElement("div");
    renderPanel(container);
    expect(container.textContent).not.toContain("掃描間隔");
    const numberInput = container.querySelector<HTMLInputElement>("input[type='number']");
    expect(numberInput).toBeNull();
  });
});

// --- RuntimeResetPanel ---

describe("RuntimeResetPanel", () => {
  function renderPanel(container: HTMLElement, overrides: Partial<Parameters<typeof RuntimeResetPanel>[0]> = {}) {
    const defaults = {
      resettingRuntimeData: false,
      onRequestConfirm: vi.fn(),
    };
    const props = { ...defaults, ...overrides };
    act(() => {
      createRoot(container).render(createElement(RuntimeResetPanel, props));
    });
    return props;
  }

  it("renders danger zone title and description", () => {
    const container = document.createElement("div");
    renderPanel(container);
    expect(container.textContent).toContain(i18n.t("settings:data.runtimeResetDescription"));
    expect(container.textContent).toContain(i18n.t("settings:data.fullResetButton"));
  });

  it("calls onRequestConfirm when reset button is clicked", () => {
    const container = document.createElement("div");
    const props = renderPanel(container);
    const btn = container.querySelector("button")!;
    act(() => {
      btn.click();
    });
    expect(props.onRequestConfirm).toHaveBeenCalled();
  });

  it("disables button and shows loading text when resettingRuntimeData is true", () => {
    const container = document.createElement("div");
    renderPanel(container, { resettingRuntimeData: true });
    const btn = container.querySelector("button") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toContain("重啟中");
  });
});
