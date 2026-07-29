import { describe, expect, it } from "vitest";

import { geminiBaseUrlPresetId, getGeminiBaseUrlPresets } from "./llmProviderConfig";

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
