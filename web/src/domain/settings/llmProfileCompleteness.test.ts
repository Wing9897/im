import { describe, expect, it } from "vitest";
import {
  firstCompleteDefaultProfile,
  isLlmProfileComplete,
} from "./llmProfileCompleteness";
import type { LlmProfile } from "../../types/llmProfiles";
import { MASKED_SECRET } from "../../types/llmProfiles";

function profile(partial: Partial<LlmProfile>): LlmProfile {
  return {
    id: "p1",
    name: "Test",
    provider: "ollama",
    baseUrl: "http://localhost:11434",
    model: "qwen3:4b",
    apiKey: "",
    thinkingEnabled: false,
    jsonMode: "disabled",
    webSearchEnabled: true,
    webSearchProvider: "auto",
    braveSearchApiKey: "",
    isDefault: false,
    staffClasses: [],
    staffInstances: [],
    createdAt: null,
    updatedAt: null,
    ...partial,
  };
}

describe("isLlmProfileComplete", () => {
  it("requires model and baseUrl for ollama", () => {
    expect(isLlmProfileComplete(profile({ model: "" }))).toBe(false);
    expect(isLlmProfileComplete(profile({ baseUrl: "" }))).toBe(false);
    expect(isLlmProfileComplete(profile({}))).toBe(true);
  });

  it("requires api key for openai_compatible (masked ok)", () => {
    expect(
      isLlmProfileComplete(
        profile({
          provider: "openai_compatible",
          baseUrl: "https://api.openai.com/v1",
          model: "gpt",
          apiKey: "",
        }),
      ),
    ).toBe(false);
    expect(
      isLlmProfileComplete(
        profile({
          provider: "openai_compatible",
          baseUrl: "https://api.openai.com/v1",
          model: "gpt",
          apiKey: MASKED_SECRET,
        }),
      ),
    ).toBe(true);
  });
});

describe("firstCompleteDefaultProfile", () => {
  it("prefers complete default, else first complete", () => {
    const incomplete = profile({ id: "a", model: "", isDefault: true });
    const complete = profile({ id: "b", isDefault: false });
    expect(firstCompleteDefaultProfile([incomplete, complete])?.id).toBe("b");
    expect(firstCompleteDefaultProfile([incomplete])).toBeNull();
  });
});
