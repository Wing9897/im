import { describe, expect, it } from "vitest";
import {
  firstCompleteProfile,
  isLlmProfileComplete,
} from "./llmProfileCompleteness";
import type { LlmProfile } from "../../types/llmProfiles";
import { MASKED_SECRET } from "../../types/llmProfiles";
import { emptyKeyedWebSearchApiKeyFields } from "./assistantWebSearchRoute";

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
    ...emptyKeyedWebSearchApiKeyFields(),
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

describe("firstCompleteProfile", () => {
  it("returns first complete profile in list order", () => {
    const incomplete = profile({ id: "a", model: "" });
    const complete = profile({ id: "b" });
    expect(firstCompleteProfile([incomplete, complete])?.id).toBe("b");
    expect(firstCompleteProfile([incomplete])).toBeNull();
  });
});
