import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { zIndex } from "../../styles/tokens";
import {
  emptyKeyedWebSearchApiKeys,
  KEYED_WEB_SEARCH_TOOL_PROVIDERS,
} from "../../domain/settings/assistantWebSearchRoute";
import { createTestHarness, type TestHarness } from "../../test/render-helpers";
import {
  AssistantWebSearchPanel,
  type AssistantWebSearchPanelProps,
} from "./AssistantWebSearchPanel";

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

function panelProps(overrides: Partial<AssistantWebSearchPanelProps> = {}): AssistantWebSearchPanelProps {
  return {
    enabled: true,
    provider: "auto",
    apiKeys: emptyKeyedWebSearchApiKeys(),
    llmProvider: "ollama",
    llmBaseUrl: "http://localhost:11434",
    onEnabledChange: vi.fn(),
    onProviderChange: vi.fn(),
    onApiKeyChange: vi.fn(),
    ...overrides,
  };
}

describe("AssistantWebSearchPanel", () => {
  let harness: TestHarness;

  beforeEach(() => {
    harness = createTestHarness();
  });

  afterEach(() => {
    harness.cleanup();
  });

  it("hides provider controls when search method is off", async () => {
    await harness.render(AssistantWebSearchPanel, panelProps({ enabled: false }));
    expect(harness.container.querySelector("#web-search-mode")).toBeTruthy();
    expect(harness.container.querySelector("#web-search-provider")).toBeNull();
    expect(harness.container.querySelector("#brave-search-api-key")).toBeNull();
    expect(harness.container.querySelector("[data-testid='web-fetch-hint']")).toBeNull();
    const status = harness.container.querySelector('[data-testid="web-search-status"]');
    expect(status?.textContent ?? "").toMatch(/關閉|关闭|off/i);
  });

  it.each(KEYED_WEB_SEARCH_TOOL_PROVIDERS)(
    "shows %s API key field when that tool provider is selected",
    async (provider) => {
      await harness.render(AssistantWebSearchPanel, panelProps({ provider }));
      expect(harness.container.querySelector(`#${provider}-search-api-key`)).toBeTruthy();
      expect(harness.container.querySelector("[data-testid='web-fetch-hint']")).toBeTruthy();
      for (const other of KEYED_WEB_SEARCH_TOOL_PROVIDERS) {
        if (other !== provider) {
          expect(harness.container.querySelector(`#${other}-search-api-key`)).toBeNull();
        }
      }
    },
  );

  it("does not show Brave key for DuckDuckGo", async () => {
    await harness.render(AssistantWebSearchPanel, panelProps({ provider: "duckduckgo" }));
    expect(harness.container.querySelector("#brave-search-api-key")).toBeNull();
    expect(harness.container.querySelector("#web-search-provider")).toBeTruthy();
  });

  it("Ollama: method is off/tool only; provider lists vendors without a fake tool-path option", async () => {
    await harness.render(AssistantWebSearchPanel, panelProps({ provider: "duckduckgo" }));

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
    await harness.render(AssistantWebSearchPanel, panelProps({ provider: "auto" }));

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
    await harness.render(
      AssistantWebSearchPanel,
      panelProps({
        llmProvider: "openai_compatible",
        llmBaseUrl: "https://api.openai.com/v1",
      }),
    );

    await openMenu(harness, "web-search-mode");
    expect(optionValues("web-search-mode")).toEqual(["off", "native", "tool"]);
    expect(optionLabel("web-search-mode", "native")).toMatch(/模型內建|模型内建|built-in/i);
    expect(harness.container.querySelector("#web-search-provider")).toBeNull();

    const status = harness.container.querySelector('[data-testid="web-search-status"]');
    expect(status?.textContent ?? "").toMatch(/OpenAI/i);
    expect(harness.container.querySelector("#brave-search-api-key")).toBeNull();
  });

  it("official Gemini + auto: native method, provider hidden", async () => {
    await harness.render(
      AssistantWebSearchPanel,
      panelProps({
        llmProvider: "gemini_compatible",
        llmBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
      }),
    );

    await openMenu(harness, "web-search-mode");
    expect(optionValues("web-search-mode")).toEqual(["off", "native", "tool"]);
    expect(optionLabel("web-search-mode", "native")).toMatch(/模型內建|模型内建|built-in/i);
    expect(harness.container.querySelector("#web-search-provider")).toBeNull();

    const status = harness.container.querySelector('[data-testid="web-search-status"]');
    expect(status?.textContent ?? "").toMatch(/Gemini/i);
    expect(harness.container.querySelector("#brave-search-api-key")).toBeNull();
  });

  it("non-official Gemini + auto: tool method, no native option", async () => {
    await harness.render(
      AssistantWebSearchPanel,
      panelProps({
        llmProvider: "gemini_compatible",
        llmBaseUrl: "https://example.com/gemini",
      }),
    );

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
    await harness.render(
      AssistantWebSearchPanel,
      panelProps({
        llmProvider: "openai_compatible",
        llmBaseUrl: "https://api.openai.com/v1",
        onEnabledChange,
        onProviderChange,
      }),
    );

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

  it.each(["brave", "tavily", "serper"] as const)(
    "tool mode: choosing %s writes that vendor",
    async (vendor) => {
      const onProviderChange = vi.fn();
      await harness.render(
        AssistantWebSearchPanel,
        panelProps({ provider: "duckduckgo", onProviderChange }),
      );

      await openMenu(harness, "web-search-provider");
      const option = document.body.querySelector<HTMLButtonElement>(
        `[data-testid="web-search-provider-option-${vendor}"]`,
      );
      expect(option).toBeTruthy();
      await act(async () => {
        option!.click();
      });
      expect(onProviderChange).toHaveBeenCalledWith(vendor);
    },
  );

  it("portals mode and provider lists to document.body", async () => {
    await harness.render(AssistantWebSearchPanel, panelProps({ provider: "duckduckgo" }));

    await openMenu(harness, "web-search-mode");
    const modeList = document.body.querySelector(
      '[data-testid="web-search-mode-list"]',
    ) as HTMLElement | null;
    expect(modeList).toBeTruthy();
    expect(harness.container.querySelector('[data-testid="web-search-mode-list"]')).toBeNull();
    expect(modeList?.parentElement).toBe(document.body);
    expect(modeList?.style.zIndex).toBe(String(zIndex.menu));

    await openMenu(harness, "web-search-provider");
    const providerList = document.body.querySelector(
      '[data-testid="web-search-provider-list"]',
    ) as HTMLElement | null;
    expect(providerList).toBeTruthy();
    expect(harness.container.querySelector('[data-testid="web-search-provider-list"]')).toBeNull();
    expect(providerList?.parentElement).toBe(document.body);
    expect(providerList?.style.zIndex).toBe(String(zIndex.menu));
  });
});
