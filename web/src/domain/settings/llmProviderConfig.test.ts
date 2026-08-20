import { describe, expect, it } from "vitest";

import {
  baseUrlAfterProviderChange,
  DEFAULT_PROVIDER_BASE_URLS,
  geminiBaseUrlPresetId,
  getGeminiBaseUrlPresets,
  isDefaultProviderBaseUrl,
} from "./llmProviderConfig";

describe("geminiBaseUrlPresetId", () => {
  it("maps official v1beta and v1 URLs to preset ids", () => {
    expect(geminiBaseUrlPresetId("https://generativelanguage.googleapis.com/v1beta")).toBe("v1beta");
    expect(geminiBaseUrlPresetId("https://generativelanguage.googleapis.com/v1beta/")).toBe("v1beta");
    expect(geminiBaseUrlPresetId("https://generativelanguage.googleapis.com/v1")).toBe("v1");
  });

  it("returns custom for unknown endpoints", () => {
    expect(geminiBaseUrlPresetId("https://proxy.example.com/gemini")).toBe("custom");
    expect(geminiBaseUrlPresetId("")).toBe("custom");
  });

  it("exposes v1beta and v1 preset URLs", () => {
    const urls = getGeminiBaseUrlPresets()
      .filter((preset) => preset.id !== "custom")
      .map((preset) => preset.url);
    expect(urls).toContain("https://generativelanguage.googleapis.com/v1beta");
    expect(urls).toContain("https://generativelanguage.googleapis.com/v1");
  });
});

describe("DEFAULT_PROVIDER_BASE_URLS", () => {
  it("maps each provider to its official default host", () => {
    expect(DEFAULT_PROVIDER_BASE_URLS.ollama).toBe("http://localhost:11434");
    expect(DEFAULT_PROVIDER_BASE_URLS.gemini_compatible).toBe(
      "https://generativelanguage.googleapis.com/v1beta",
    );
    expect(DEFAULT_PROVIDER_BASE_URLS.openai_compatible).toBe("https://api.openai.com/v1");
    expect(DEFAULT_PROVIDER_BASE_URLS.openrouter).toBe("https://openrouter.ai/api/v1");
  });
});

describe("isDefaultProviderBaseUrl", () => {
  it("matches leftover Ollama localhost including trailing slash", () => {
    expect(isDefaultProviderBaseUrl("http://localhost:11434")).toBe(true);
    expect(isDefaultProviderBaseUrl("http://localhost:11434/")).toBe(true);
    expect(isDefaultProviderBaseUrl(" HTTP://LOCALHOST:11434 ")).toBe(true);
    expect(isDefaultProviderBaseUrl("http://localhost:11434", "ollama")).toBe(true);
    expect(isDefaultProviderBaseUrl("http://localhost:11434", "gemini_compatible")).toBe(false);
  });

  it("does not treat a custom proxy as a provider default", () => {
    expect(isDefaultProviderBaseUrl("https://proxy.example.com/gemini")).toBe(false);
    expect(isDefaultProviderBaseUrl("http://127.0.0.1:11434")).toBe(false);
    expect(isDefaultProviderBaseUrl("")).toBe(false);
  });
});

describe("baseUrlAfterProviderChange", () => {
  it("fills the next provider default when the URL is empty", () => {
    expect(baseUrlAfterProviderChange("", "gemini_compatible")).toBe(
      DEFAULT_PROVIDER_BASE_URLS.gemini_compatible,
    );
    expect(baseUrlAfterProviderChange("   ", "openai_compatible")).toBe(
      DEFAULT_PROVIDER_BASE_URLS.openai_compatible,
    );
  });

  it("replaces leftover Ollama localhost when switching to Gemini", () => {
    expect(baseUrlAfterProviderChange("http://localhost:11434", "gemini_compatible")).toBe(
      DEFAULT_PROVIDER_BASE_URLS.gemini_compatible,
    );
    expect(baseUrlAfterProviderChange("http://localhost:11434/", "gemini_compatible")).toBe(
      DEFAULT_PROVIDER_BASE_URLS.gemini_compatible,
    );
  });

  it("replaces any other provider default when switching", () => {
    expect(
      baseUrlAfterProviderChange(DEFAULT_PROVIDER_BASE_URLS.gemini_compatible, "openai_compatible"),
    ).toBe(DEFAULT_PROVIDER_BASE_URLS.openai_compatible);
    expect(
      baseUrlAfterProviderChange(DEFAULT_PROVIDER_BASE_URLS.openai_compatible, "openrouter"),
    ).toBe(DEFAULT_PROVIDER_BASE_URLS.openrouter);
    expect(baseUrlAfterProviderChange(DEFAULT_PROVIDER_BASE_URLS.openrouter, "ollama")).toBe(
      DEFAULT_PROVIDER_BASE_URLS.ollama,
    );
  });

  it("keeps a custom Gemini proxy typed after selecting Gemini", () => {
    const custom = "https://proxy.example.com/gemini";
    expect(baseUrlAfterProviderChange(custom, "openai_compatible")).toBe(custom);
    expect(baseUrlAfterProviderChange(custom, "gemini_compatible")).toBe(custom);
  });
});
