import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestHarness, type TestHarness } from "../../test/render-helpers";
import { AssistantWebSearchPanel } from "./AssistantWebSearchPanel";

describe("AssistantWebSearchPanel", () => {
  let harness: TestHarness;

  beforeEach(() => {
    harness = createTestHarness();
  });

  afterEach(() => {
    harness.cleanup();
  });

  it("hides provider controls when disabled", async () => {
    await harness.render(AssistantWebSearchPanel, {
      enabled: false,
      provider: "auto",
      braveApiKey: "",
      llmProvider: "ollama",
      llmBaseUrl: "http://localhost:11434",
      onEnabledChange: vi.fn(),
      onProviderChange: vi.fn(),
      onBraveApiKeyChange: vi.fn(),
    });
    expect(harness.container.querySelector("#web-search-provider")).toBeNull();
  });

  it("shows Brave API key field when provider is brave", async () => {
    await harness.render(AssistantWebSearchPanel, {
      enabled: true,
      provider: "brave",
      braveApiKey: "",
      llmProvider: "ollama",
      llmBaseUrl: "http://localhost:11434",
      onEnabledChange: vi.fn(),
      onProviderChange: vi.fn(),
      onBraveApiKeyChange: vi.fn(),
    });
    expect(harness.container.querySelector("#brave-search-api-key")).toBeTruthy();
  });

  it("does not show Brave key for DuckDuckGo", async () => {
    await harness.render(AssistantWebSearchPanel, {
      enabled: true,
      provider: "duckduckgo",
      braveApiKey: "",
      llmProvider: "ollama",
      llmBaseUrl: "http://localhost:11434",
      onEnabledChange: vi.fn(),
      onProviderChange: vi.fn(),
      onBraveApiKeyChange: vi.fn(),
    });
    expect(harness.container.querySelector("#brave-search-api-key")).toBeNull();
    expect(harness.container.querySelector("#web-search-provider")).toBeTruthy();
  });

  it("shows OpenAI native status for auto + official OpenAI", async () => {
    await harness.render(AssistantWebSearchPanel, {
      enabled: true,
      provider: "auto",
      braveApiKey: "",
      llmProvider: "openai_compatible",
      llmBaseUrl: "https://api.openai.com/v1",
      onEnabledChange: vi.fn(),
      onProviderChange: vi.fn(),
      onBraveApiKeyChange: vi.fn(),
    });
    const status = harness.container.querySelector('[data-testid="web-search-status"]');
    expect(status?.textContent ?? "").toMatch(/OpenAI/i);
    expect(harness.container.querySelector("#brave-search-api-key")).toBeNull();
  });

  it("shows Gemini fallback honesty for auto + non-official Gemini base", async () => {
    await harness.render(AssistantWebSearchPanel, {
      enabled: true,
      provider: "auto",
      braveApiKey: "",
      llmProvider: "gemini_compatible",
      llmBaseUrl: "https://example.com/gemini",
      onEnabledChange: vi.fn(),
      onProviderChange: vi.fn(),
      onBraveApiKeyChange: vi.fn(),
    });
    const status = harness.container.querySelector('[data-testid="web-search-status"]');
    expect(status?.textContent ?? "").toMatch(/fallback|回退|回退/i);
  });
});
