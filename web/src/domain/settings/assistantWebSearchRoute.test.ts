import { describe, expect, it } from "vitest";
import { defaultSettingsSnapshot } from "../../test/settingsSnapshot";
import {
  effectiveAssistantLlm,
  isOfficialGeminiBase,
  isOfficialOpenaiBase,
  llmHasNativeWebSearch,
  resolveAssistantWebSearchStatus,
} from "./assistantWebSearchRoute";

describe("assistantWebSearchRoute", () => {
  it("detects official OpenAI / Gemini hosts", () => {
    expect(isOfficialOpenaiBase("https://api.openai.com/v1")).toBe(true);
    expect(isOfficialOpenaiBase("https://proxy.example/v1")).toBe(false);
    expect(isOfficialGeminiBase("https://generativelanguage.googleapis.com/v1beta")).toBe(true);
    expect(isOfficialGeminiBase("https://gemini.example/v1")).toBe(false);
  });

  it("llmHasNativeWebSearch only for official OpenAI / Gemini", () => {
    expect(llmHasNativeWebSearch("openai_compatible", "https://api.openai.com/v1")).toBe(true);
    expect(llmHasNativeWebSearch("gemini_compatible", "https://generativelanguage.googleapis.com/v1beta")).toBe(
      true,
    );
    expect(llmHasNativeWebSearch("ollama", "http://localhost:11434")).toBe(false);
    expect(llmHasNativeWebSearch("openai_compatible", "https://proxy.example/v1")).toBe(false);
    expect(llmHasNativeWebSearch("openrouter", "https://openrouter.ai/api/v1")).toBe(false);
  });

  it("resolves auto to OpenAI native on official base", () => {
    expect(
      resolveAssistantWebSearchStatus({
        enabled: true,
        searchProvider: "auto",
        llmProvider: "openai_compatible",
        llmBaseUrl: "https://api.openai.com/v1",
      }),
    ).toBe("openai_native");
  });

  it("resolves auto to Gemini native on official base", () => {
    expect(
      resolveAssistantWebSearchStatus({
        enabled: true,
        searchProvider: "auto",
        llmProvider: "gemini_compatible",
        llmBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
      }),
    ).toBe("gemini_native");
  });

  it("falls back for Ollama auto", () => {
    expect(
      resolveAssistantWebSearchStatus({
        enabled: true,
        searchProvider: "auto",
        llmProvider: "ollama",
        llmBaseUrl: "http://localhost:11434",
      }),
    ).toBe("auto_fallback_tool");
  });

  it("manual Brave forces tool path", () => {
    expect(
      resolveAssistantWebSearchStatus({
        enabled: true,
        searchProvider: "brave",
        llmProvider: "openai_compatible",
        llmBaseUrl: "https://api.openai.com/v1",
      }),
    ).toBe("tool_brave");
  });

  it("effectiveAssistantLlm follows global by default", () => {
    const eff = effectiveAssistantLlm({
      ...defaultSettingsSnapshot,
      llmProvider: "openai_compatible",
      openaiBaseUrl: "https://api.openai.com/v1",
      assistantLlmProvider: "",
    });
    expect(eff.provider).toBe("openai_compatible");
    expect(eff.baseUrl).toBe("https://api.openai.com/v1");
  });
});
