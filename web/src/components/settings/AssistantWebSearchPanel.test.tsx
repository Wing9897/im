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

  it("Ollama + duckduckgo: hides Auto option; status is tool path only", async () => {
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
    const select = harness.container.querySelector("#web-search-provider") as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toEqual(["duckduckgo", "brave"]);
    expect(values).not.toContain("auto");
    const status = harness.container.querySelector('[data-testid="web-search-status"]');
    expect(status?.textContent ?? "").toMatch(/DuckDuckGo/i);
    expect(status?.textContent ?? "").not.toMatch(/原生|native|跟 LLM|follow LLM/i);
  });

  it("Ollama + saved auto: labels Auto as tool path, not follow-LLM", async () => {
    await harness.render(AssistantWebSearchPanel, {
      enabled: true,
      provider: "auto",
      braveApiKey: "",
      llmProvider: "ollama",
      llmBaseUrl: "http://localhost:11434",
      onEnabledChange: vi.fn(),
      onProviderChange: vi.fn(),
      onBraveApiKeyChange: vi.fn(),
    });
    const select = harness.container.querySelector("#web-search-provider") as HTMLSelectElement;
    const autoOpt = Array.from(select.options).find((o) => o.value === "auto");
    expect(autoOpt).toBeTruthy();
    expect(autoOpt?.textContent ?? "").toMatch(/工具路徑|工具路径|Tool path/i);
    expect(autoOpt?.textContent ?? "").not.toMatch(/跟 LLM|follow LLM|原生/i);
    const status = harness.container.querySelector('[data-testid="web-search-status"]');
    expect(status?.textContent ?? "").toMatch(/DuckDuckGo|Brave|工具/i);
    expect(status?.textContent ?? "").not.toMatch(/跟 LLM|follow LLM/i);
    // No duplicate fallback / DDG note paragraphs beyond the single status line
    expect(harness.container.querySelectorAll('[data-testid="web-search-status"]')).toHaveLength(1);
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
    const select = harness.container.querySelector("#web-search-provider") as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toContain("auto");
    const autoOpt = Array.from(select.options).find((o) => o.value === "auto");
    expect(autoOpt?.textContent ?? "").toMatch(/原生|native/i);
    const status = harness.container.querySelector('[data-testid="web-search-status"]');
    expect(status?.textContent ?? "").toMatch(/OpenAI/i);
    expect(harness.container.querySelector("#brave-search-api-key")).toBeNull();
  });

  it("non-official Gemini: Auto labeled as tool path", async () => {
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
    const select = harness.container.querySelector("#web-search-provider") as HTMLSelectElement;
    const autoOpt = Array.from(select.options).find((o) => o.value === "auto");
    expect(autoOpt?.textContent ?? "").toMatch(/工具路徑|工具路径|Tool path/i);
    const status = harness.container.querySelector('[data-testid="web-search-status"]');
    expect(status?.textContent ?? "").toMatch(/DuckDuckGo|Brave|工具|tool/i);
    expect(status?.textContent ?? "").not.toMatch(/將使用 Gemini|Using Gemini|OpenAI 原生|OpenAI native/i);
  });
});
