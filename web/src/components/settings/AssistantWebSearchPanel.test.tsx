import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestHarness, type TestHarness } from "../../test/render-helpers";
import { AssistantWebSearchPanel } from "./AssistantWebSearchPanel";

async function openMenu(harness: TestHarness, testId: string) {
  const trigger = harness.container.querySelector<HTMLButtonElement>(`[data-testid="${testId}-value"]`);
  expect(trigger).toBeTruthy();
  await act(async () => {
    trigger!.click();
  });
  return trigger!;
}

function optionValues(testId: string): string[] {
  return Array.from(
    document.body.querySelectorAll<HTMLButtonElement>(`[data-testid^="${testId}-option-"]`),
  ).map((btn) => btn.getAttribute("data-testid")!.replace(`${testId}-option-`, ""));
}

function optionLabel(testId: string, value: string): string {
  return document.body.querySelector(`[data-testid="${testId}-option-${value}"]`)?.textContent ?? "";
}

const baseHandlers = () => ({
  onEnabledChange: vi.fn(),
  onProviderChange: vi.fn(),
  onBraveApiKeyChange: vi.fn(),
  onTavilyApiKeyChange: vi.fn(),
  onPerplexityApiKeyChange: vi.fn(),
  onSerperApiKeyChange: vi.fn(),
});

describe("AssistantWebSearchPanel", () => {
  let harness: TestHarness;

  beforeEach(() => {
    harness = createTestHarness();
  });

  afterEach(() => {
    harness.cleanup();
  });

  it("hides provider controls when search method is off", async () => {
    await harness.render(AssistantWebSearchPanel, {
      enabled: false,
      provider: "auto",
      braveApiKey: "",
      tavilyApiKey: "",
      perplexityApiKey: "",
      serperApiKey: "",
      llmProvider: "ollama",
      llmBaseUrl: "http://localhost:11434",
      ...baseHandlers(),
    });
    expect(harness.container.querySelector("#web-search-mode")).toBeTruthy();
    expect(harness.container.querySelector("#web-search-provider")).toBeNull();
    expect(harness.container.querySelector("#brave-search-api-key")).toBeNull();
    expect(harness.container.querySelector("[data-testid='web-fetch-hint']")).toBeNull();
    const status = harness.container.querySelector('[data-testid="web-search-status"]');
    expect(status?.textContent ?? "").toMatch(/關閉|关闭|off/i);
  });

  it("shows Brave API key field when tool provider is brave", async () => {
    await harness.render(AssistantWebSearchPanel, {
      enabled: true,
      provider: "brave",
      braveApiKey: "",
      tavilyApiKey: "",
      perplexityApiKey: "",
      serperApiKey: "",
      llmProvider: "ollama",
      llmBaseUrl: "http://localhost:11434",
      ...baseHandlers(),
    });
    expect(harness.container.querySelector("#web-search-provider")).toBeTruthy();
    expect(harness.container.querySelector("#brave-search-api-key")).toBeTruthy();
    expect(harness.container.querySelector("[data-testid='web-fetch-hint']")).toBeTruthy();
    expect(harness.container.querySelector("#tavily-search-api-key")).toBeNull();
    expect(harness.container.querySelector("#perplexity-search-api-key")).toBeNull();
    expect(harness.container.querySelector("#serper-search-api-key")).toBeNull();
  });

  it("shows Tavily API key field when tool provider is tavily", async () => {
    await harness.render(AssistantWebSearchPanel, {
      enabled: true,
      provider: "tavily",
      braveApiKey: "",
      tavilyApiKey: "",
      perplexityApiKey: "",
      serperApiKey: "",
      llmProvider: "ollama",
      llmBaseUrl: "http://localhost:11434",
      ...baseHandlers(),
    });
    expect(harness.container.querySelector("#tavily-search-api-key")).toBeTruthy();
    expect(harness.container.querySelector("#brave-search-api-key")).toBeNull();
    expect(harness.container.querySelector("#perplexity-search-api-key")).toBeNull();
    expect(harness.container.querySelector("#serper-search-api-key")).toBeNull();
  });

  it("shows Perplexity API key field when tool provider is perplexity", async () => {
    await harness.render(AssistantWebSearchPanel, {
      enabled: true,
      provider: "perplexity",
      braveApiKey: "",
      tavilyApiKey: "",
      perplexityApiKey: "",
      serperApiKey: "",
      llmProvider: "ollama",
      llmBaseUrl: "http://localhost:11434",
      ...baseHandlers(),
    });
    expect(harness.container.querySelector("#perplexity-search-api-key")).toBeTruthy();
    expect(harness.container.querySelector("#brave-search-api-key")).toBeNull();
    expect(harness.container.querySelector("#tavily-search-api-key")).toBeNull();
    expect(harness.container.querySelector("#serper-search-api-key")).toBeNull();
  });

  it("shows Serper API key field when tool provider is serper", async () => {
    await harness.render(AssistantWebSearchPanel, {
      enabled: true,
      provider: "serper",
      braveApiKey: "",
      tavilyApiKey: "",
      perplexityApiKey: "",
      serperApiKey: "",
      llmProvider: "ollama",
      llmBaseUrl: "http://localhost:11434",
      ...baseHandlers(),
    });
    expect(harness.container.querySelector("#serper-search-api-key")).toBeTruthy();
    expect(harness.container.querySelector("#brave-search-api-key")).toBeNull();
    expect(harness.container.querySelector("#tavily-search-api-key")).toBeNull();
    expect(harness.container.querySelector("#perplexity-search-api-key")).toBeNull();
  });

  it("does not show Brave key for DuckDuckGo", async () => {
    await harness.render(AssistantWebSearchPanel, {
      enabled: true,
      provider: "duckduckgo",
      braveApiKey: "",
      tavilyApiKey: "",
      perplexityApiKey: "",
      serperApiKey: "",
      llmProvider: "ollama",
      llmBaseUrl: "http://localhost:11434",
      ...baseHandlers(),
    });
    expect(harness.container.querySelector("#brave-search-api-key")).toBeNull();
    expect(harness.container.querySelector("#web-search-provider")).toBeTruthy();
  });

  it("Ollama: method is off/tool only; provider lists vendors without a fake tool-path option", async () => {
    await harness.render(AssistantWebSearchPanel, {
      enabled: true,
      provider: "duckduckgo",
      braveApiKey: "",
      tavilyApiKey: "",
      perplexityApiKey: "",
      serperApiKey: "",
      llmProvider: "ollama",
      llmBaseUrl: "http://localhost:11434",
      ...baseHandlers(),
    });

    await openMenu(harness, "web-search-mode");
    expect(optionValues("web-search-mode")).toEqual(["off", "tool"]);
    expect(optionLabel("web-search-mode", "tool")).toMatch(/web\.search/i);
    expect(optionValues("web-search-mode")).not.toContain("native");
    expect(optionValues("web-search-mode")).not.toContain("auto");

    await openMenu(harness, "web-search-provider");
    expect(optionValues("web-search-provider")).toEqual(["duckduckgo", "brave", "tavily", "perplexity", "serper"]);
    expect(optionValues("web-search-provider")).not.toContain("auto");
    expect(optionLabel("web-search-provider", "duckduckgo")).toMatch(/DuckDuckGo/i);
    expect(optionLabel("web-search-provider", "brave")).toMatch(/Brave/i);
    const providerLabels = optionValues("web-search-provider")
      .map((value) => optionLabel("web-search-provider", value))
      .join(" ");
    expect(providerLabels).not.toMatch(/工具路徑|工具路径|Tool path/i);

    const status = harness.container.querySelector('[data-testid="web-search-status"]');
    expect(status?.textContent ?? "").toMatch(/DuckDuckGo/i);
    expect(status?.textContent ?? "").not.toMatch(/原生|native|跟 LLM|follow LLM/i);
  });

  it("Ollama + saved auto: treats as tool + DuckDuckGo, not a competing vendor", async () => {
    await harness.render(AssistantWebSearchPanel, {
      enabled: true,
      provider: "auto",
      braveApiKey: "",
      tavilyApiKey: "",
      perplexityApiKey: "",
      serperApiKey: "",
      llmProvider: "ollama",
      llmBaseUrl: "http://localhost:11434",
      ...baseHandlers(),
    });

    await openMenu(harness, "web-search-mode");
    expect(optionValues("web-search-mode")).toEqual(["off", "tool"]);
    expect(optionValues("web-search-mode")).not.toContain("native");

    await openMenu(harness, "web-search-provider");
    expect(optionValues("web-search-provider")).toEqual(["duckduckgo", "brave", "tavily", "perplexity", "serper"]);
    expect(optionValues("web-search-provider")).not.toContain("auto");
    const providerLabels = optionValues("web-search-provider")
      .map((value) => optionLabel("web-search-provider", value))
      .join(" ");
    expect(providerLabels).not.toMatch(/工具路徑|工具路径|Tool path/i);

    const modeTrigger = harness.container.querySelector('[data-testid="web-search-mode-value"]');
    expect(modeTrigger?.textContent ?? "").toMatch(/工具|Tool/i);
    const providerTrigger = harness.container.querySelector('[data-testid="web-search-provider-value"]');
    expect(providerTrigger?.textContent ?? "").toMatch(/DuckDuckGo/i);

    const status = harness.container.querySelector('[data-testid="web-search-status"]');
    expect(status?.textContent ?? "").toMatch(/DuckDuckGo|Brave|工具/i);
    expect(status?.textContent ?? "").not.toMatch(/跟 LLM|follow LLM/i);
    expect(harness.container.querySelectorAll('[data-testid="web-search-status"]')).toHaveLength(1);
  });

  it("official OpenAI + auto: native method, provider hidden", async () => {
    await harness.render(AssistantWebSearchPanel, {
      enabled: true,
      provider: "auto",
      braveApiKey: "",
      tavilyApiKey: "",
      perplexityApiKey: "",
      serperApiKey: "",
      llmProvider: "openai_compatible",
      llmBaseUrl: "https://api.openai.com/v1",
      ...baseHandlers(),
    });

    await openMenu(harness, "web-search-mode");
    expect(optionValues("web-search-mode")).toEqual(["off", "native", "tool"]);
    expect(optionLabel("web-search-mode", "native")).toMatch(/模型內建|模型内建|built-in/i);
    expect(harness.container.querySelector("#web-search-provider")).toBeNull();

    const status = harness.container.querySelector('[data-testid="web-search-status"]');
    expect(status?.textContent ?? "").toMatch(/OpenAI/i);
    expect(harness.container.querySelector("#brave-search-api-key")).toBeNull();
  });

  it("official Gemini + auto: native method, provider hidden", async () => {
    await harness.render(AssistantWebSearchPanel, {
      enabled: true,
      provider: "auto",
      braveApiKey: "",
      tavilyApiKey: "",
      perplexityApiKey: "",
      serperApiKey: "",
      llmProvider: "gemini_compatible",
      llmBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
      ...baseHandlers(),
    });

    await openMenu(harness, "web-search-mode");
    expect(optionValues("web-search-mode")).toEqual(["off", "native", "tool"]);
    expect(optionLabel("web-search-mode", "native")).toMatch(/模型內建|模型内建|built-in/i);
    expect(harness.container.querySelector("#web-search-provider")).toBeNull();

    const status = harness.container.querySelector('[data-testid="web-search-status"]');
    expect(status?.textContent ?? "").toMatch(/Gemini/i);
    expect(harness.container.querySelector("#brave-search-api-key")).toBeNull();
  });

  it("non-official Gemini + auto: tool method, no native option", async () => {
    await harness.render(AssistantWebSearchPanel, {
      enabled: true,
      provider: "auto",
      braveApiKey: "",
      tavilyApiKey: "",
      perplexityApiKey: "",
      serperApiKey: "",
      llmProvider: "gemini_compatible",
      llmBaseUrl: "https://example.com/gemini",
      ...baseHandlers(),
    });

    await openMenu(harness, "web-search-mode");
    expect(optionValues("web-search-mode")).toEqual(["off", "tool"]);
    expect(optionValues("web-search-mode")).not.toContain("native");

    expect(harness.container.querySelector("#web-search-provider")).toBeTruthy();
    await openMenu(harness, "web-search-provider");
    expect(optionValues("web-search-provider")).toEqual(["duckduckgo", "brave", "tavily", "perplexity", "serper"]);

    const status = harness.container.querySelector('[data-testid="web-search-status"]');
    expect(status?.textContent ?? "").toMatch(/DuckDuckGo|Brave|工具|tool/i);
    expect(status?.textContent ?? "").not.toMatch(/將使用 Gemini|Using Gemini|OpenAI 原生|OpenAI native/i);
  });

  it("official OpenAI: switching to tool writes duckduckgo, not auto", async () => {
    const onEnabledChange = vi.fn();
    const onProviderChange = vi.fn();
    await harness.render(AssistantWebSearchPanel, {
      enabled: true,
      provider: "auto",
      braveApiKey: "",
      tavilyApiKey: "",
      perplexityApiKey: "",
      serperApiKey: "",
      llmProvider: "openai_compatible",
      llmBaseUrl: "https://api.openai.com/v1",
      onEnabledChange,
      onProviderChange,
      onBraveApiKeyChange: vi.fn(),
      onTavilyApiKeyChange: vi.fn(),
      onPerplexityApiKeyChange: vi.fn(),
      onSerperApiKeyChange: vi.fn(),
    });

    await openMenu(harness, "web-search-mode");
    const toolOption = document.body.querySelector<HTMLButtonElement>(
      '[data-testid="web-search-mode-option-tool"]',
    );
    expect(toolOption).toBeTruthy();
    await act(async () => {
      toolOption!.click();
    });
    expect(onEnabledChange).toHaveBeenCalledWith(true);
    expect(onProviderChange).toHaveBeenCalledWith("duckduckgo");
  });

  it("tool mode: choosing Brave writes brave and does not invent a tool-path provider", async () => {
    const onProviderChange = vi.fn();
    await harness.render(AssistantWebSearchPanel, {
      enabled: true,
      provider: "duckduckgo",
      braveApiKey: "",
      tavilyApiKey: "",
      perplexityApiKey: "",
      serperApiKey: "",
      llmProvider: "ollama",
      llmBaseUrl: "http://localhost:11434",
      onEnabledChange: vi.fn(),
      onProviderChange,
      onBraveApiKeyChange: vi.fn(),
      onTavilyApiKeyChange: vi.fn(),
      onPerplexityApiKeyChange: vi.fn(),
      onSerperApiKeyChange: vi.fn(),
    });

    await openMenu(harness, "web-search-provider");
    const braveOption = document.body.querySelector<HTMLButtonElement>(
      '[data-testid="web-search-provider-option-brave"]',
    );
    expect(braveOption).toBeTruthy();
    await act(async () => {
      braveOption!.click();
    });
    expect(onProviderChange).toHaveBeenCalledWith("brave");
  });

  it("tool mode: choosing Tavily writes tavily", async () => {
    const onProviderChange = vi.fn();
    await harness.render(AssistantWebSearchPanel, {
      enabled: true,
      provider: "duckduckgo",
      braveApiKey: "",
      tavilyApiKey: "",
      perplexityApiKey: "",
      serperApiKey: "",
      llmProvider: "ollama",
      llmBaseUrl: "http://localhost:11434",
      onEnabledChange: vi.fn(),
      onProviderChange,
      onBraveApiKeyChange: vi.fn(),
      onTavilyApiKeyChange: vi.fn(),
      onPerplexityApiKeyChange: vi.fn(),
      onSerperApiKeyChange: vi.fn(),
    });

    await openMenu(harness, "web-search-provider");
    const tavilyOption = document.body.querySelector<HTMLButtonElement>(
      '[data-testid="web-search-provider-option-tavily"]',
    );
    expect(tavilyOption).toBeTruthy();
    await act(async () => {
      tavilyOption!.click();
    });
    expect(onProviderChange).toHaveBeenCalledWith("tavily");
  });

  it("tool mode: choosing Serper writes serper", async () => {
    const onProviderChange = vi.fn();
    await harness.render(AssistantWebSearchPanel, {
      enabled: true,
      provider: "duckduckgo",
      braveApiKey: "",
      tavilyApiKey: "",
      perplexityApiKey: "",
      serperApiKey: "",
      llmProvider: "ollama",
      llmBaseUrl: "http://localhost:11434",
      onEnabledChange: vi.fn(),
      onProviderChange,
      onBraveApiKeyChange: vi.fn(),
      onTavilyApiKeyChange: vi.fn(),
      onPerplexityApiKeyChange: vi.fn(),
      onSerperApiKeyChange: vi.fn(),
    });

    await openMenu(harness, "web-search-provider");
    const serperOption = document.body.querySelector<HTMLButtonElement>(
      '[data-testid="web-search-provider-option-serper"]',
    );
    expect(serperOption).toBeTruthy();
    await act(async () => {
      serperOption!.click();
    });
    expect(onProviderChange).toHaveBeenCalledWith("serper");
  });
});
