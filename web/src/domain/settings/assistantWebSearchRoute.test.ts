import { describe, expect, it } from "vitest";
import {
  isOfficialGeminiBase,
  isOfficialOpenaiBase,
  llmHasNativeWebSearch,
  normalizeWebSearchProviderSetting,
  resolveAssistantWebSearchStatus,
} from "./assistantWebSearchRoute";

describe("assistantWebSearchRoute", () => {
  it("normalizes provider setting", () => {
    expect(normalizeWebSearchProviderSetting("brave")).toBe("brave");
    expect(normalizeWebSearchProviderSetting("DUCKDUCKGO")).toBe("duckduckgo");
    expect(normalizeWebSearchProviderSetting("auto")).toBe("auto");
    expect(normalizeWebSearchProviderSetting("nope")).toBe("auto");
  });

  it("detects official OpenAI / Gemini bases", () => {
    expect(isOfficialOpenaiBase("https://api.openai.com/v1")).toBe(true);
    expect(isOfficialOpenaiBase("https://proxy.example.com")).toBe(false);
    expect(isOfficialGeminiBase("https://generativelanguage.googleapis.com/v1beta")).toBe(true);
    expect(isOfficialGeminiBase("https://proxy.example.com/gemini")).toBe(false);
  });

  it("reports native web search capability", () => {
    expect(llmHasNativeWebSearch("openai_compatible", "https://api.openai.com/v1")).toBe(true);
    expect(llmHasNativeWebSearch("gemini_compatible", "https://generativelanguage.googleapis.com/v1beta")).toBe(
      true,
    );
    expect(llmHasNativeWebSearch("ollama", "http://localhost:11434")).toBe(false);
    expect(llmHasNativeWebSearch("openrouter", "https://openrouter.ai/api/v1")).toBe(false);
  });

  it("resolves status kinds", () => {
    expect(
      resolveAssistantWebSearchStatus({
        enabled: false,
        searchProvider: "auto",
        llmProvider: "openai_compatible",
        llmBaseUrl: "https://api.openai.com/v1",
      }),
    ).toBe("disabled");

    expect(
      resolveAssistantWebSearchStatus({
        enabled: true,
        searchProvider: "auto",
        llmProvider: "openai_compatible",
        llmBaseUrl: "https://api.openai.com/v1",
      }),
    ).toBe("openai_native");

    expect(
      resolveAssistantWebSearchStatus({
        enabled: true,
        searchProvider: "auto",
        llmProvider: "gemini_compatible",
        llmBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
      }),
    ).toBe("gemini_native");

    expect(
      resolveAssistantWebSearchStatus({
        enabled: true,
        searchProvider: "brave",
        llmProvider: "ollama",
        llmBaseUrl: "http://localhost:11434",
      }),
    ).toBe("tool_brave");

    expect(
      resolveAssistantWebSearchStatus({
        enabled: true,
        searchProvider: "duckduckgo",
        llmProvider: "ollama",
        llmBaseUrl: "http://localhost:11434",
      }),
    ).toBe("tool_duckduckgo");

    expect(
      resolveAssistantWebSearchStatus({
        enabled: true,
        searchProvider: "auto",
        llmProvider: "ollama",
        llmBaseUrl: "http://localhost:11434",
      }),
    ).toBe("auto_fallback_tool");
  });
});
