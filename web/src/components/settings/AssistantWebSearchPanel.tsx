import { useTranslation } from "react-i18next";
import {
  isWebSearchToolProvider,
  llmHasNativeWebSearch,
  normalizeWebSearchProviderSetting,
  resolveAssistantWebSearchStatus,
  resolveWebSearchToolProvider,
  resolveWebSearchUiMode,
  settingsFromWebSearchUiMode,
  WEB_SEARCH_TOOL_PROVIDERS,
  isKeyedWebSearchToolProvider,
  type KeyedWebSearchToolProvider,
  type WebSearchProviderSetting,
  type WebSearchToolProvider,
  type WebSearchUiMode,
} from "../../domain/settings/assistantWebSearchRoute";
import type { LlmProvider } from "../../types";
import { FormStack, MenuSelect, PasswordField, SettingsRow } from "../ui";
import { formHelpClass } from "../ui/pageTypography";

export type WebSearchProvider = WebSearchProviderSetting;

interface AssistantWebSearchPanelProps {
  enabled: boolean;
  provider: string;
  braveApiKey: string;
  tavilyApiKey: string;
  perplexityApiKey: string;
  serperApiKey: string;
  /** Effective assistant LLM (follow / override already resolved by parent). */
  llmProvider: LlmProvider;
  llmBaseUrl: string;
  onEnabledChange: (value: boolean) => void;
  onProviderChange: (value: WebSearchProvider) => void;
  onBraveApiKeyChange: (value: string) => void;
  onTavilyApiKeyChange: (value: string) => void;
  onPerplexityApiKeyChange: (value: string) => void;
  onSerperApiKeyChange: (value: string) => void;
}

function parseUiMode(value: string): WebSearchUiMode | null {
  if (value === "off" || value === "native" || value === "tool") {
    return value;
  }
  return null;
}

const PROVIDER_LABEL_KEYS: Record<WebSearchToolProvider, string> = {
  duckduckgo: "webSearch.providerDuckDuckGo",
  brave: "webSearch.providerBrave",
  tavily: "webSearch.providerTavily",
  perplexity: "webSearch.providerPerplexity",
  serper: "webSearch.providerSerper",
};

const KEYED_FIELD_META: Record<
  KeyedWebSearchToolProvider,
  { id: string; labelKey: string; helpKey: string; placeholderKey: string }
> = {
  brave: {
    id: "brave-search-api-key",
    labelKey: "webSearch.braveKeyLabel",
    helpKey: "webSearch.braveKeyHelp",
    placeholderKey: "webSearch.braveKeyPlaceholder",
  },
  tavily: {
    id: "tavily-search-api-key",
    labelKey: "webSearch.tavilyKeyLabel",
    helpKey: "webSearch.tavilyKeyHelp",
    placeholderKey: "webSearch.tavilyKeyPlaceholder",
  },
  perplexity: {
    id: "perplexity-search-api-key",
    labelKey: "webSearch.perplexityKeyLabel",
    helpKey: "webSearch.perplexityKeyHelp",
    placeholderKey: "webSearch.perplexityKeyPlaceholder",
  },
  serper: {
    id: "serper-search-api-key",
    labelKey: "webSearch.serperKeyLabel",
    helpKey: "webSearch.serperKeyHelp",
    placeholderKey: "webSearch.serperKeyPlaceholder",
  },
};

export function AssistantWebSearchPanel({
  enabled,
  provider,
  braveApiKey,
  tavilyApiKey,
  perplexityApiKey,
  serperApiKey,
  llmProvider,
  llmBaseUrl,
  onEnabledChange,
  onProviderChange,
  onBraveApiKeyChange,
  onTavilyApiKeyChange,
  onPerplexityApiKeyChange,
  onSerperApiKeyChange,
}: AssistantWebSearchPanelProps) {
  const { t } = useTranslation("settings");
  const resolvedProvider = normalizeWebSearchProviderSetting(provider);
  const nativeAvailable = llmHasNativeWebSearch(llmProvider, llmBaseUrl);
  const uiMode = resolveWebSearchUiMode({
    enabled,
    searchProvider: resolvedProvider,
    nativeAvailable,
  });
  const toolProvider = resolveWebSearchToolProvider(resolvedProvider);
  const status = resolveAssistantWebSearchStatus({
    enabled,
    searchProvider: resolvedProvider,
    llmProvider,
    llmBaseUrl,
  });

  const statusText = (() => {
    switch (status) {
      case "disabled":
        return t("webSearch.statusDisabled");
      case "openai_native":
        return t("webSearch.statusOpenaiNative");
      case "gemini_native":
        return t("webSearch.statusGeminiNative");
      case "tool_brave":
        return t("webSearch.statusToolBrave");
      case "tool_tavily":
        return t("webSearch.statusToolTavily");
      case "tool_perplexity":
        return t("webSearch.statusToolPerplexity");
      case "tool_serper":
        return t("webSearch.statusToolSerper");
      case "tool_duckduckgo":
        return t("webSearch.statusToolDuckDuckGo");
      case "auto_fallback_tool":
        return t("webSearch.statusAutoTool");
      default:
        return "";
    }
  })();

  const applySettings = (nextEnabled: boolean, nextProvider: WebSearchProviderSetting) => {
    onEnabledChange(nextEnabled);
    onProviderChange(nextProvider);
  };

  const keyedValues: Record<KeyedWebSearchToolProvider, string> = {
    brave: braveApiKey,
    tavily: tavilyApiKey,
    perplexity: perplexityApiKey,
    serper: serperApiKey,
  };
  const keyedOnChange: Record<KeyedWebSearchToolProvider, (value: string) => void> = {
    brave: onBraveApiKeyChange,
    tavily: onTavilyApiKeyChange,
    perplexity: onPerplexityApiKeyChange,
    serper: onSerperApiKeyChange,
  };
  const keyedProvider = uiMode === "tool" && isKeyedWebSearchToolProvider(toolProvider) ? toolProvider : null;
  const keyedField = keyedProvider ? KEYED_FIELD_META[keyedProvider] : null;

  return (
    <FormStack gap="lg">
      <SettingsRow
        label={t("webSearch.modeLabel")}
        htmlFor="web-search-mode"
        help={nativeAvailable ? t("webSearch.modeHelp") : t("webSearch.modeHelpNoNative")}
      >
        <MenuSelect
          id="web-search-mode"
          variant="field"
          value={uiMode}
          options={[
            { value: "off", label: t("webSearch.modeOff") },
            ...(nativeAvailable ? [{ value: "native", label: t("webSearch.modeNative") }] : []),
            { value: "tool", label: t("webSearch.modeTool") },
          ]}
          onChange={(value) => {
            const mode = parseUiMode(value);
            if (!mode) return;
            const next = settingsFromWebSearchUiMode(mode, resolvedProvider);
            applySettings(next.enabled, next.provider);
          }}
          aria-label={t("webSearch.modeLabel")}
          data-testid="web-search-mode"
        />
      </SettingsRow>

      {uiMode === "tool" ? (
        <SettingsRow
          label={t("webSearch.providerLabel")}
          htmlFor="web-search-provider"
          help={t("webSearch.providerHelp")}
        >
          <MenuSelect
            id="web-search-provider"
            variant="field"
            value={toolProvider}
            options={WEB_SEARCH_TOOL_PROVIDERS.map((value) => ({
              value,
              label: t(PROVIDER_LABEL_KEYS[value]),
            }))}
            onChange={(value) => {
              const next = normalizeWebSearchProviderSetting(value);
              if (isWebSearchToolProvider(next)) {
                applySettings(true, next);
              }
            }}
            aria-label={t("webSearch.providerLabel")}
            data-testid="web-search-provider"
          />
        </SettingsRow>
      ) : null}

      <p className={`mb-0 ${formHelpClass}`} data-testid="web-search-status">
        {statusText}
      </p>

      {uiMode === "tool" ? (
        <p className={`mb-0 ${formHelpClass}`} data-testid="web-fetch-hint">
          {t("webSearch.fetchHint")}
        </p>
      ) : null}

      {keyedField && keyedProvider ? (
        <SettingsRow
          label={t(keyedField.labelKey)}
          htmlFor={keyedField.id}
          help={t(keyedField.helpKey)}
        >
          <PasswordField
            id={keyedField.id}
            value={keyedValues[keyedProvider]}
            placeholder={t(keyedField.placeholderKey)}
            onChange={(event) => keyedOnChange[keyedProvider](event.target.value)}
            autoComplete="off"
          />
        </SettingsRow>
      ) : null}
    </FormStack>
  );
}
