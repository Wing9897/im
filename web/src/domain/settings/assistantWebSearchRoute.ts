import type { LlmProvider } from "../../types";

export type WebSearchProviderSetting = "auto" | "duckduckgo" | "brave";

export type AssistantWebSearchStatusKind =
  | "disabled"
  | "openai_native"
  | "gemini_native"
  | "tool_duckduckgo"
  | "tool_brave"
  | "auto_fallback_tool";

export function normalizeWebSearchProviderSetting(value: string | undefined): WebSearchProviderSetting {
  const trimmed = (value ?? "").trim().toLowerCase();
  if (trimmed === "brave" || trimmed === "duckduckgo" || trimmed === "auto") {
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
  if (setting === "brave") {
    return "tool_brave";
  }
  if (setting === "duckduckgo") {
    return "tool_duckduckgo";
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
