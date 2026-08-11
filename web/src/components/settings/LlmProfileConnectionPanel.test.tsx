import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "../../i18n";
import type { LlmProvider } from "../../types";
import { LlmProfileConnectionPanel } from "./LlmProfileConnectionPanel";

describe("LlmProfileConnectionPanel", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  const defaultProps = {
    llmProvider: "openrouter" as LlmProvider,
    llmBaseUrl: "",
    llmModel: "",
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

  beforeEach(async () => {
    await i18n.changeLanguage("zh-Hant");
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

  function renderPanel(overrides: Partial<typeof defaultProps> = {}) {
    const props = { ...defaultProps, ...overrides };
    act(() => {
      root = createRoot(container);
      root.render(createElement(LlmProfileConnectionPanel, props));
    });
  }

  it("does not render a 掃描間隔 field", () => {
    renderPanel();
    expect(container.textContent).not.toContain("掃描間隔");
  });

  describe("Remaining fields preservation (Req 4.3)", () => {
    it("renders provider tile selector", () => {
      renderPanel();
      const providerButtons = container.querySelectorAll("button[aria-pressed]");
      expect(providerButtons.length).toBe(4);
    });

    it("renders Base URL input field", () => {
      renderPanel({ llmProvider: "openrouter" });
      expect(container.textContent).toContain("OpenRouter API URL");
    });

    it("renders Model input field", () => {
      renderPanel({ llmProvider: "openrouter" });
      expect(container.textContent).toContain("模型名稱");
    });

    it("renders API Key input field", () => {
      renderPanel();
      expect(container.textContent).toContain("API Key");
    });

    it("renders JSON 輸出模式 select when provider is openai_compatible", () => {
      renderPanel({ llmProvider: "openai_compatible" });
      expect(container.textContent).toContain("JSON 輸出模式");
      // Provider uses tiles; JSON mode is MenuSelect (no native <select>).
      expect(container.querySelectorAll("select")).toHaveLength(0);
      expect(container.querySelector("#openai-json-mode")).not.toBeNull();
      expect(container.querySelector('[data-testid="openai-json-mode"]')).not.toBeNull();
    });

    it("does not render JSON 輸出模式 when provider is not openai_compatible", () => {
      renderPanel({ llmProvider: "ollama" });
      expect(container.textContent).not.toContain("JSON 輸出模式");
    });

    it("renders Ollama thinking checkbox when provider is ollama", () => {
      renderPanel({ llmProvider: "ollama", ollamaThinkingEnabled: false });
      expect(container.textContent).toContain("Thinking 模式");
      const checkbox = container.querySelector<HTMLInputElement>("#ollama-thinking-enabled");
      expect(checkbox).toBeTruthy();
      expect(checkbox!.checked).toBe(false);
    });

    it("calls onOllamaThinkingEnabledChange when thinking checkbox toggles", () => {
      const onOllamaThinkingEnabledChange = vi.fn();
      renderPanel({
        llmProvider: "ollama",
        ollamaThinkingEnabled: false,
        onOllamaThinkingEnabledChange,
      });
      const checkbox = container.querySelector<HTMLInputElement>("#ollama-thinking-enabled")!;
      act(() => {
        checkbox.click();
      });
      expect(onOllamaThinkingEnabledChange).toHaveBeenCalledWith(true);
    });

    it("renders Gemini base URL combobox with preset picker button", () => {
      renderPanel({
        llmProvider: "gemini_compatible",
        llmBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
      });

      expect(container.textContent).toContain("Gemini 相容 API URL");
      expect(container.querySelector("datalist")).toBeNull();
      expect(container.querySelector("button[aria-label='選擇 Gemini API 版本']")).toBeTruthy();
      expect(container.querySelector<HTMLInputElement>("input[role='combobox']")?.value).toBe(
        "https://generativelanguage.googleapis.com/v1beta",
      );
    });
  });

  describe("OpenRouter provider selected", () => {
    it("shows base URL label as 'OpenRouter API URL' with correct placeholder", () => {
      renderPanel({ llmProvider: "openrouter" });

      const labels = Array.from(container.querySelectorAll("label"));
      const baseUrlLabel = labels.find(
        (l) => l.textContent === "OpenRouter API URL",
      );
      expect(baseUrlLabel).toBeTruthy();

      const baseUrlInput = baseUrlLabel!.parentElement!.querySelector("input");
      expect(baseUrlInput).toBeTruthy();
      expect(baseUrlInput!.placeholder).toBe("https://openrouter.ai/api/v1");
    });

    it("shows model label as '模型名稱' with placeholder 'openai/gpt-4o'", () => {
      renderPanel({ llmProvider: "openrouter" });

      const labels = Array.from(container.querySelectorAll("label"));
      const modelLabel = labels.find((l) => l.textContent === "模型名稱");
      expect(modelLabel).toBeTruthy();

      const modelInput = modelLabel!.parentElement!.querySelector("input");
      expect(modelInput).toBeTruthy();
      expect(modelInput!.placeholder).toBe("openai/gpt-4o");
    });

    it("shows API key with placeholder 'sk-or-...' and password input type", () => {
      renderPanel({ llmProvider: "openrouter" });

      const labels = Array.from(container.querySelectorAll("label"));
      const apiKeyLabel = labels.find((l) => l.textContent === "API Key");
      expect(apiKeyLabel).toBeTruthy();

      const apiKeyInput = apiKeyLabel!.parentElement!.querySelector("input");
      expect(apiKeyInput).toBeTruthy();
      expect(apiKeyInput!.placeholder).toBe("sk-or-...");
      expect(apiKeyInput!.type).toBe("password");
    });

    it("provider tiles include OpenRouter and call onLlmProviderChange", () => {
      renderPanel({ llmProvider: "openrouter" });

      const openRouterTile = Array.from(
        container.querySelectorAll("button[aria-pressed]"),
      ).find((btn) => btn.textContent?.includes("OpenRouter"));
      expect(openRouterTile).toBeTruthy();
      expect(openRouterTile!.getAttribute("aria-pressed")).toBe("true");

      const geminiTile = Array.from(
        container.querySelectorAll("button[aria-pressed]"),
      ).find((btn) => btn.textContent?.includes("Gemini"));
      expect(geminiTile).toBeTruthy();
      act(() => {
        geminiTile!.click();
      });
      expect(defaultProps.onLlmProviderChange).toHaveBeenCalledWith("gemini_compatible");
    });
  });
});
