import type { LlmProvider, SystemSettingsSnapshot } from "../../types";
import { getLlmProviderConfig } from "./llmProviderConfig";

export type WebSearchProviderSetting = "auto" | "duckduckgo" | "brave";

export type AssistantWebSearchStatusKind =
  | "disabled"
  | "openai_native"
  | "gemini_native"
  | "tool_duckduckgo"
  | "tool_brave"
  | "auto_fallback_tool";

function isAssistantLlmFollow(value: string | undefined): boolean {
  const trimmed = (value ?? "").trim();
  return !trimmed || trimmed === "follow";
}

function normalizeProvider(value: string | undefined, fallback: LlmProvider): LlmProvider {
  const trimmed = (value ?? "").trim();
  if (
    trimmed === "ollama" ||
    trimmed === "openai_compatible" ||
    trimmed === "gemini_compatible" ||
    trimmed === "openrouter"
  ) {
    return trimmed;
  }
  return fallback;
}

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

/** Effective assistant LLM (follow global or override) for search routing UX. */
export function effectiveAssistantLlm(settings: SystemSettingsSnapshot): {
  provider: LlmProvider;
  baseUrl: string;
} {
  const follow = isAssistantLlmFollow(settings.assistantLlmProvider);
  const provider = follow
    ? settings.llmProvider
    : normalizeProvider(settings.assistantLlmProvider, settings.llmProvider);
  const fields = getLlmProviderConfig()[provider];
  const globalBase = String(settings[fields.baseUrlKey] ?? "");
  const baseUrl = follow
    ? globalBase
    : settings.assistantLlmBaseUrl.trim() || globalBase;
  return { provider, baseUrl };
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
