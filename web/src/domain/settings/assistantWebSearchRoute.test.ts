import { describe, expect, it } from "vitest";
import {
  emptyKeyedWebSearchApiKeyFields,
  emptyKeyedWebSearchApiKeys,
  isOfficialGeminiBase,
  isOfficialOpenaiBase,
  keyedWebSearchApiKeyField,
  keyedWebSearchApiKeysFromFields,
  keyedWebSearchFieldMeta,
  llmHasNativeWebSearch,
  normalizeWebSearchProviderSetting,
  resolveAssistantWebSearchStatus,
  resolveWebSearchToolProvider,
  resolveWebSearchUiMode,
  settingsFromWebSearchUiMode,
  webSearchProviderLabelKey,
  webSearchToolStatusKey,
} from "./assistantWebSearchRoute";

describe("assistantWebSearchRoute", () => {
  it("normalizes provider setting", () => {
    expect(normalizeWebSearchProviderSetting("brave")).toBe("brave");
    expect(normalizeWebSearchProviderSetting("DUCKDUCKGO")).toBe("duckduckgo");
    expect(normalizeWebSearchProviderSetting("tavily")).toBe("tavily");
    expect(normalizeWebSearchProviderSetting("PERPLEXITY")).toBe("perplexity");
    expect(normalizeWebSearchProviderSetting("serper")).toBe("serper");
    expect(normalizeWebSearchProviderSetting("SERPER")).toBe("serper");
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
    expect(llmHasNativeWebSearch("openai_compatible", "https://api.openai.com")).toBe(true);
    expect(llmHasNativeWebSearch("gemini_compatible", "https://generativelanguage.googleapis.com/v1beta")).toBe(
      true,
    );
    expect(llmHasNativeWebSearch("gemini_compatible", "https://generativelanguage.googleapis.com/v1")).toBe(
      true,
    );
    expect(llmHasNativeWebSearch("openai_compatible", "https://openrouter.ai/api/v1")).toBe(false);
    expect(llmHasNativeWebSearch("openai_compatible", "https://generativelanguage.googleapis.com/v1beta")).toBe(
      false,
    );
    expect(llmHasNativeWebSearch("gemini_compatible", "https://example.com/gemini")).toBe(false);
    expect(llmHasNativeWebSearch("gemini_compatible", "https://api.openai.com/v1")).toBe(false);
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
        searchProvider: "tavily",
        llmProvider: "ollama",
        llmBaseUrl: "http://localhost:11434",
      }),
    ).toBe("tool_tavily");

    expect(
      resolveAssistantWebSearchStatus({
        enabled: true,
        searchProvider: "perplexity",
        llmProvider: "ollama",
        llmBaseUrl: "http://localhost:11434",
      }),
    ).toBe("tool_perplexity");

    expect(
      resolveAssistantWebSearchStatus({
        enabled: true,
        searchProvider: "serper",
        llmProvider: "ollama",
        llmBaseUrl: "http://localhost:11434",
      }),
    ).toBe("tool_serper");

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

  it("maps stored settings onto UI mode vs tool vendor", () => {
    expect(
      resolveWebSearchUiMode({
        enabled: false,
        searchProvider: "auto",
        nativeAvailable: true,
      }),
    ).toBe("off");

    expect(
      resolveWebSearchUiMode({
        enabled: true,
        searchProvider: "auto",
        nativeAvailable: true,
      }),
    ).toBe("native");

    expect(
      resolveWebSearchUiMode({
        enabled: true,
        searchProvider: "auto",
        nativeAvailable: false,
      }),
    ).toBe("tool");

    expect(
      resolveWebSearchUiMode({
        enabled: true,
        searchProvider: "duckduckgo",
        nativeAvailable: true,
      }),
    ).toBe("tool");

    expect(
      resolveWebSearchUiMode({
        enabled: true,
        searchProvider: "brave",
        nativeAvailable: true,
      }),
    ).toBe("tool");

    expect(resolveWebSearchToolProvider("auto")).toBe("duckduckgo");
    expect(resolveWebSearchToolProvider("duckduckgo")).toBe("duckduckgo");
    expect(resolveWebSearchToolProvider("brave")).toBe("brave");
    expect(resolveWebSearchToolProvider("tavily")).toBe("tavily");
    expect(resolveWebSearchToolProvider("perplexity")).toBe("perplexity");
    expect(resolveWebSearchToolProvider("serper")).toBe("serper");
  });

  it("writes auto only for native mode; tool mode never persists auto", () => {
    expect(settingsFromWebSearchUiMode("off", "auto")).toEqual({
      enabled: false,
      provider: "auto",
    });
    expect(settingsFromWebSearchUiMode("off", "brave")).toEqual({
      enabled: false,
      provider: "brave",
    });
    expect(settingsFromWebSearchUiMode("native", "duckduckgo")).toEqual({
      enabled: true,
      provider: "auto",
    });
    expect(settingsFromWebSearchUiMode("tool", "auto")).toEqual({
      enabled: true,
      provider: "duckduckgo",
    });
    expect(settingsFromWebSearchUiMode("tool", "brave")).toEqual({
      enabled: true,
      provider: "brave",
    });
    expect(settingsFromWebSearchUiMode("tool", "tavily")).toEqual({
      enabled: true,
      provider: "tavily",
    });
    expect(settingsFromWebSearchUiMode("tool", "perplexity")).toEqual({
      enabled: true,
      provider: "perplexity",
    });
    expect(settingsFromWebSearchUiMode("tool", "serper")).toEqual({
      enabled: true,
      provider: "serper",
    });
  });

  it("maps keyed vendors onto wire api-key fields", () => {
    expect(keyedWebSearchApiKeyField("brave")).toBe("braveSearchApiKey");
    expect(keyedWebSearchApiKeyField("serper")).toBe("serperSearchApiKey");
    expect(emptyKeyedWebSearchApiKeyFields()).toEqual({
      braveSearchApiKey: "",
      tavilySearchApiKey: "",
      perplexitySearchApiKey: "",
      serperSearchApiKey: "",
    });
    expect(keyedWebSearchApiKeysFromFields(emptyKeyedWebSearchApiKeyFields())).toEqual(
      emptyKeyedWebSearchApiKeys(),
    );
  });

  it("derives i18n keys from vendor ids without a hand-listed map", () => {
    expect(webSearchProviderLabelKey("duckduckgo")).toBe("webSearch.providers.duckduckgo");
    expect(webSearchToolStatusKey("brave")).toBe("webSearch.statusTool.brave");
    expect(keyedWebSearchFieldMeta("serper")).toEqual({
      id: "serper-search-api-key",
      labelKey: "webSearch.keys.serper.label",
      helpKey: "webSearch.keys.serper.help",
      placeholderKey: "webSearch.keys.serper.placeholder",
    });
  });
});
