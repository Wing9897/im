import { useTranslation } from "react-i18next";
import {
  normalizeWebSearchProviderSetting,
  resolveAssistantWebSearchStatus,
  type WebSearchProviderSetting,
} from "../../domain/settings/assistantWebSearchRoute";
import type { LlmProvider } from "../../types";
import { CheckboxField, FormStack, PasswordField, SelectField, SettingsRow } from "../ui";
import { formHelpClass } from "../ui/pageTypography";

export type WebSearchProvider = WebSearchProviderSetting;

interface AssistantWebSearchPanelProps {
  enabled: boolean;
  provider: string;
  braveApiKey: string;
  /** Effective assistant LLM (follow / override already resolved by parent). */
  llmProvider: LlmProvider;
  llmBaseUrl: string;
  onEnabledChange: (value: boolean) => void;
  onProviderChange: (value: WebSearchProvider) => void;
  onBraveApiKeyChange: (value: string) => void;
}

export function AssistantWebSearchPanel({
  enabled,
  provider,
  braveApiKey,
  llmProvider,
  llmBaseUrl,
  onEnabledChange,
  onProviderChange,
  onBraveApiKeyChange,
}: AssistantWebSearchPanelProps) {
  const { t } = useTranslation("settings");
  const resolvedProvider = normalizeWebSearchProviderSetting(provider);
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
      case "tool_duckduckgo":
        return t("webSearch.statusToolDuckDuckGo");
      case "auto_fallback_tool":
        return t("webSearch.statusAutoFallback");
      default:
        return "";
    }
  })();

  return (
    <FormStack gap="lg">
      <SettingsRow label={t("webSearch.sectionTitle")} help={t("webSearch.sectionHelp")}>
        <CheckboxField
          id="assistant-web-search-enabled"
          label={t("webSearch.enabledLabel")}
          checked={enabled}
          onChange={(event) => onEnabledChange(event.target.checked)}
          aria-label={t("webSearch.enabledAria")}
        />
      </SettingsRow>

      {enabled ? (
        <>
          <SettingsRow
            label={t("webSearch.providerLabel")}
            htmlFor="web-search-provider"
            help={t("webSearch.providerHelp")}
          >
            <SelectField
              id="web-search-provider"
              value={resolvedProvider}
              onChange={(event) => {
                const next = normalizeWebSearchProviderSetting(event.target.value);
                onProviderChange(next);
              }}
            >
              <option value="auto">{t("webSearch.providerAuto")}</option>
              <option value="duckduckgo">{t("webSearch.providerDuckDuckGo")}</option>
              <option value="brave">{t("webSearch.providerBrave")}</option>
            </SelectField>
          </SettingsRow>

          <p className={`mb-0 ${formHelpClass}`} data-testid="web-search-status">
            {statusText}
          </p>

          {resolvedProvider === "brave" ? (
            <SettingsRow
              label={t("webSearch.braveKeyLabel")}
              htmlFor="brave-search-api-key"
              help={t("webSearch.braveKeyHelp")}
            >
              <PasswordField
                id="brave-search-api-key"
                value={braveApiKey}
                placeholder={t("webSearch.braveKeyPlaceholder")}
                onChange={(event) => onBraveApiKeyChange(event.target.value)}
                autoComplete="off"
              />
            </SettingsRow>
          ) : null}

          {resolvedProvider === "duckduckgo" ? (
            <p className={`mb-0 ${formHelpClass}`}>{t("webSearch.duckDuckGoNote")}</p>
          ) : null}

          {resolvedProvider === "auto" && status === "auto_fallback_tool" ? (
            <p className={`mb-0 ${formHelpClass}`}>{t("webSearch.autoFallbackNote")}</p>
          ) : null}
        </>
      ) : (
        <p className={`mb-0 ${formHelpClass}`}>{t("webSearch.statusDisabled")}</p>
      )}
    </FormStack>
  );
}
