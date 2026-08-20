import type { LlmProvider } from "../../types";

export type WebSearchProviderSetting = "auto" | "duckduckgo" | "brave" | "tavily" | "perplexity" | "serper";

/** UI search method — orthogonal to the tool vendor. */
export type WebSearchUiMode = "off" | "native" | "tool";

/** Vendor for the ``web.search`` tool path only (never ``auto``). */
export type WebSearchToolProvider = "duckduckgo" | "brave" | "tavily" | "perplexity" | "serper";

export const WEB_SEARCH_TOOL_PROVIDERS: readonly WebSearchToolProvider[] = [
  "duckduckgo",
  "brave",
  "tavily",
  "perplexity",
  "serper",
] as const;

/** Tool vendors that require a stored API key (fail closed when empty). */
export const KEYED_WEB_SEARCH_TOOL_PROVIDERS = [
  "brave",
  "tavily",
  "perplexity",
  "serper",
] as const satisfies readonly WebSearchToolProvider[];

export type KeyedWebSearchToolProvider = (typeof KEYED_WEB_SEARCH_TOOL_PROVIDERS)[number];

export type AssistantWebSearchStatusKind =
  | "disabled"
  | "openai_native"
  | "gemini_native"
  | "tool_duckduckgo"
  | "tool_brave"
  | "tool_tavily"
  | "tool_perplexity"
  | "tool_serper"
  | "auto_fallback_tool";

const TOOL_PROVIDER_SET = new Set<string>(WEB_SEARCH_TOOL_PROVIDERS);

export function isWebSearchToolProvider(value: string): value is WebSearchToolProvider {
  return TOOL_PROVIDER_SET.has(value);
}

const KEYED_PROVIDER_SET = new Set<string>(KEYED_WEB_SEARCH_TOOL_PROVIDERS);

export function isKeyedWebSearchToolProvider(value: string): value is KeyedWebSearchToolProvider {
  return KEYED_PROVIDER_SET.has(value);
}

export function normalizeWebSearchProviderSetting(value: string | undefined): WebSearchProviderSetting {
  const trimmed = (value ?? "").trim().toLowerCase();
  if (trimmed === "auto" || isWebSearchToolProvider(trimmed)) {
    return trimmed;
  }
  return "auto";
}

function hostnameOf(url: string): string {
  try {
    return new URL(url.trim()).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function isOfficialOpenaiBase(baseUrl: string): boolean {
  const host = hostnameOf(baseUrl);
  return host === "api.openai.com" || host.endsWith(".openai.com");
}

export function isOfficialGeminiBase(baseUrl: string): boolean {
  return hostnameOf(baseUrl) === "generativelanguage.googleapis.com";
}

/** True only when the LLM can use official native web search. */
export function llmHasNativeWebSearch(llmProvider: LlmProvider, llmBaseUrl: string): boolean {
  if (llmProvider === "openai_compatible" && isOfficialOpenaiBase(llmBaseUrl)) {
    return true;
  }
  if (llmProvider === "gemini_compatible" && isOfficialGeminiBase(llmBaseUrl)) {
    return true;
  }
  return false;
}

/**
 * Map stored enabled + provider onto the two-field UI.
 * ``auto`` is native only when the LLM actually supports it; otherwise it is
 * the tool path (server still falls back to DuckDuckGo).
 */
export function resolveWebSearchUiMode(args: {
  enabled: boolean;
  searchProvider: string;
  nativeAvailable: boolean;
}): WebSearchUiMode {
  if (!args.enabled) {
    return "off";
  }
  const setting = normalizeWebSearchProviderSetting(args.searchProvider);
  if (setting === "auto" && args.nativeAvailable) {
    return "native";
  }
  return "tool";
}

export function resolveWebSearchToolProvider(searchProvider: string): WebSearchToolProvider {
  const setting = normalizeWebSearchProviderSetting(searchProvider);
  return setting === "auto" ? "duckduckgo" : setting;
}

/** Persist UI mode without collapsing vendor into a fake ``auto``/tool-path option. */
export function settingsFromWebSearchUiMode(
  mode: WebSearchUiMode,
  currentProvider: WebSearchProviderSetting,
): { enabled: boolean; provider: WebSearchProviderSetting } {
  if (mode === "off") {
    return { enabled: false, provider: currentProvider };
  }
  if (mode === "native") {
    return { enabled: true, provider: "auto" };
  }
  return {
    enabled: true,
    provider: currentProvider === "auto" ? "duckduckgo" : currentProvider,
  };
}

export function resolveAssistantWebSearchStatus(args: {
  enabled: boolean;
  searchProvider: string;
  llmProvider: LlmProvider;
  llmBaseUrl: string;
}): AssistantWebSearchStatusKind {
  if (!args.enabled) {
    return "disabled";
  }
  const setting = normalizeWebSearchProviderSetting(args.searchProvider);
  if (isWebSearchToolProvider(setting)) {
    return `tool_${setting}`;
  }
  // auto
  if (args.llmProvider === "openai_compatible" && isOfficialOpenaiBase(args.llmBaseUrl)) {
    return "openai_native";
  }
  if (args.llmProvider === "gemini_compatible" && isOfficialGeminiBase(args.llmBaseUrl)) {
    return "gemini_native";
  }
  return "auto_fallback_tool";
}
