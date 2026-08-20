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

export type AssistantWebSearchPanelProps = {
  enabled: boolean;
  provider: string;
  apiKeys: Record<KeyedWebSearchToolProvider, string>;
  /** Effective assistant LLM (follow / override already resolved by parent). */
  llmProvider: LlmProvider;
  llmBaseUrl: string;
  onEnabledChange: (value: boolean) => void;
  onProviderChange: (value: WebSearchProvider) => void;
  onApiKeyChange: (provider: KeyedWebSearchToolProvider, value: string) => void;
};

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

const TOOL_STATUS_KEYS: Record<WebSearchToolProvider, string> = {
  duckduckgo: "webSearch.statusToolDuckDuckGo",
  brave: "webSearch.statusToolBrave",
  tavily: "webSearch.statusToolTavily",
  perplexity: "webSearch.statusToolPerplexity",
  serper: "webSearch.statusToolSerper",
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
  apiKeys,
  llmProvider,
  llmBaseUrl,
  onEnabledChange,
  onProviderChange,
  onApiKeyChange,
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
      case "auto_fallback_tool":
        return t("webSearch.statusAutoTool");
      default:
        if (status.startsWith("tool_")) {
          const vendor = status.slice("tool_".length);
          if (isWebSearchToolProvider(vendor)) {
            return t(TOOL_STATUS_KEYS[vendor]);
          }
        }
        return "";
    }
  })();

  const applySettings = (nextEnabled: boolean, nextProvider: WebSearchProviderSetting) => {
    onEnabledChange(nextEnabled);
    onProviderChange(nextProvider);
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
            value={apiKeys[keyedProvider]}
            placeholder={t(keyedField.placeholderKey)}
            onChange={(event) => onApiKeyChange(keyedProvider, event.target.value)}
            autoComplete="off"
          />
        </SettingsRow>
      ) : null}
    </FormStack>
  );
}
