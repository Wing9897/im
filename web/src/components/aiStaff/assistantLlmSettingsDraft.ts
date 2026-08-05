import { getLlmProviderConfig } from "../../domain/settings/llmProviderConfig";
import type { LlmProvider, SystemSettingsSnapshot } from "../../types";

export const FOLLOW_PROVIDER_VALUE = "";

export function isAssistantLlmFollow(value: string | undefined): boolean {
  const trimmed = (value ?? "").trim();
  return !trimmed || trimmed === "follow";
}

export function normalizeCustomProvider(
  value: string | undefined,
  fallback: LlmProvider,
): LlmProvider {
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

export function providerConnection(
  settings: SystemSettingsSnapshot,
  provider: LlmProvider,
): { baseUrl: string; model: string; apiKey: string } {
  const fields = getLlmProviderConfig()[provider];
  return {
    baseUrl: String(settings[fields.baseUrlKey] ?? ""),
    model: String(settings[fields.modelKey] ?? ""),
    apiKey: fields.apiKeyKey ? String(settings[fields.apiKeyKey] ?? "") : "",
  };
}

export type AssistantLlmDraft = {
  follow: boolean;
  provider: LlmProvider;
  baseUrl: string;
  model: string;
  apiKey: string;
  historyMaxMessages: string;
  historyMaxChars: string;
};

export function buildAssistantLlmDraft(settings: SystemSettingsSnapshot): AssistantLlmDraft {
  const follow = isAssistantLlmFollow(settings.assistantLlmProvider);
  const provider = follow
    ? settings.llmProvider
    : normalizeCustomProvider(settings.assistantLlmProvider, settings.llmProvider);
  const global = providerConnection(settings, provider);
  const historyMaxMessages = settings.agentHistoryMaxMessages.trim() || "40";
  const historyMaxChars = settings.agentHistoryMaxChars.trim() || "48000";
  if (follow) {
    return {
      follow: true,
      provider,
      baseUrl: global.baseUrl,
      model: global.model,
      apiKey: global.apiKey,
      historyMaxMessages,
      historyMaxChars,
    };
  }
  return {
    follow: false,
    provider,
    baseUrl: settings.assistantLlmBaseUrl.trim() || global.baseUrl,
    model: settings.assistantLlmModel.trim() || global.model,
    apiKey: settings.assistantLlmApiKey.trim() || global.apiKey,
    historyMaxMessages,
    historyMaxChars,
  };
}

export function draftToAssistantLlmPatch(
  draft: AssistantLlmDraft,
): Partial<SystemSettingsSnapshot> {
  const historyPatch = {
    agentHistoryMaxMessages: draft.historyMaxMessages.trim() || "40",
    agentHistoryMaxChars: draft.historyMaxChars.trim() || "48000",
  };
  if (draft.follow) {
    return { assistantLlmProvider: FOLLOW_PROVIDER_VALUE, ...historyPatch };
  }
  return {
    assistantLlmProvider: draft.provider,
    assistantLlmBaseUrl: draft.baseUrl,
    assistantLlmModel: draft.model,
    assistantLlmApiKey: draft.apiKey,
    ...historyPatch,
  };
}
