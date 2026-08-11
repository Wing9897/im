import type { TFunction } from "i18next";
import i18n from "../../i18n";
import type { LlmProvider } from "../../types";

type Translate = TFunction | typeof i18n.t;

type GeminiBaseUrlPreset = {
  id: string;
  /** Shown in the combobox suggestion list. */
  label: string;
  url: string;
};

/** Official Gemini REST API base URLs; users may still type a custom endpoint. */
export function getGeminiBaseUrlPresets(
  t: Translate = i18n.t.bind(i18n),
): readonly GeminiBaseUrlPreset[] {
  return [
    {
      id: "v1beta",
      label: String(t("settings:llm.geminiPresetBeta")),
      url: "https://generativelanguage.googleapis.com/v1beta",
    },
    {
      id: "v1",
      label: String(t("settings:llm.geminiPresetStable")),
      url: "https://generativelanguage.googleapis.com/v1",
    },
    { id: "custom", label: String(t("settings:llm.geminiPresetCustom")), url: "" },
  ] as const;
}

export function geminiBaseUrlPresetId(
  url: string,
  presets: readonly GeminiBaseUrlPreset[] = getGeminiBaseUrlPresets(),
): string {
  const normalized = url.trim().replace(/\/$/, "");
  const match = presets.find(
    (preset) => preset.id !== "custom" && preset.url === normalized,
  );
  return match?.id ?? "custom";
}

type LlmProviderFieldConfig = {
  emptyBaseUrlMessage: string;
  emptyModelMessage: string;
  label: string;
  hint?: string;
  baseUrlLabel: string;
  modelLabel: string;
  baseUrlPlaceholder: string;
  modelPlaceholder: string;
  apiKeyPlaceholder: string;
};

export function getLlmProviderConfig(
  t: Translate = i18n.t.bind(i18n),
): Record<LlmProvider, LlmProviderFieldConfig> {
  return {
    ollama: {
      emptyBaseUrlMessage: String(t("settings:llm.providers.ollama.emptyBaseUrlMessage")),
      emptyModelMessage: String(t("settings:llm.providers.ollama.emptyModelMessage")),
      label: String(t("settings:llm.providers.ollama.label")),
      hint: String(t("settings:llm.providers.ollama.hint")),
      baseUrlLabel: String(t("settings:llm.providers.ollama.baseUrlLabel")),
      modelLabel: String(t("settings:llm.providers.ollama.modelLabel")),
      baseUrlPlaceholder: "http://localhost:11434",
      modelPlaceholder: "qwen3:4b",
      apiKeyPlaceholder: String(t("settings:llm.providers.ollama.apiKeyPlaceholder")),
    },
    openai_compatible: {
      emptyBaseUrlMessage: String(t("settings:llm.providers.openai_compatible.emptyBaseUrlMessage")),
      emptyModelMessage: String(t("settings:llm.providers.openai_compatible.emptyModelMessage")),
      label: String(t("settings:llm.providers.openai_compatible.label")),
      baseUrlLabel: String(t("settings:llm.providers.openai_compatible.baseUrlLabel")),
      modelLabel: String(t("settings:llm.providers.openai_compatible.modelLabel")),
      baseUrlPlaceholder: "https://api.openai.com/v1",
      modelPlaceholder: "provider-specific model id",
      apiKeyPlaceholder: "sk-...",
    },
    gemini_compatible: {
      emptyBaseUrlMessage: String(t("settings:llm.providers.gemini_compatible.emptyBaseUrlMessage")),
      emptyModelMessage: String(t("settings:llm.providers.gemini_compatible.emptyModelMessage")),
      label: String(t("settings:llm.providers.gemini_compatible.label")),
      baseUrlLabel: String(t("settings:llm.providers.gemini_compatible.baseUrlLabel")),
      modelLabel: String(t("settings:llm.providers.gemini_compatible.modelLabel")),
      baseUrlPlaceholder: "https://generativelanguage.googleapis.com/v1beta",
      modelPlaceholder: "gemini-3.1-flash-lite",
      apiKeyPlaceholder: "AIza...",
    },
    openrouter: {
      emptyBaseUrlMessage: String(t("settings:llm.providers.openrouter.emptyBaseUrlMessage")),
      emptyModelMessage: String(t("settings:llm.providers.openrouter.emptyModelMessage")),
      label: String(t("settings:llm.providers.openrouter.label")),
      baseUrlLabel: String(t("settings:llm.providers.openrouter.baseUrlLabel")),
      modelLabel: String(t("settings:llm.providers.openrouter.modelLabel")),
      baseUrlPlaceholder: "https://openrouter.ai/api/v1",
      modelPlaceholder: "openai/gpt-4o",
      apiKeyPlaceholder: "sk-or-...",
    },
  };
}

const LLM_PROVIDER_ORDER: LlmProvider[] = [
  "gemini_compatible",
  "openai_compatible",
  "ollama",
  "openrouter",
];

export function getLlmProviderOptions(
  t: Translate = i18n.t.bind(i18n),
): Array<{ id: LlmProvider; label: string; hint?: string }> {
  const config = getLlmProviderConfig(t);
  return LLM_PROVIDER_ORDER.map((id) => ({
    id,
    label: config[id].label,
    hint: config[id].hint,
  }));
}

export function isLlmProvider(value: string | undefined | null): value is LlmProvider {
  return (
    value === "ollama" ||
    value === "openai_compatible" ||
    value === "gemini_compatible" ||
    value === "openrouter"
  );
}

export function normalizeLlmProvider(
  value: string | undefined | null,
  fallback: LlmProvider = "ollama",
): LlmProvider {
  return isLlmProvider(value) ? value : fallback;
}
