import { useTranslation } from "react-i18next";
import {
  llmHasNativeWebSearch,
  normalizeWebSearchProviderSetting,
  resolveAssistantWebSearchStatus,
  type WebSearchProviderSetting,
} from "../../domain/settings/assistantWebSearchRoute";
import type { LlmProvider } from "../../types";
import { CheckboxField, FormStack, MenuSelect, PasswordField, SettingsRow } from "../ui";
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
  const nativeAvailable = llmHasNativeWebSearch(llmProvider, llmBaseUrl);
  const status = resolveAssistantWebSearchStatus({
    enabled,
    searchProvider: resolvedProvider,
    llmProvider,
    llmBaseUrl,
  });

  // Auto is meaningful for official OpenAI/Gemini only. Keep the option visible when
  // the saved value is still "auto" so the select is not blank (tool-path label).
  const showAutoOption = nativeAvailable || resolvedProvider === "auto";

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
        return t("webSearch.statusAutoTool");
      default:
        return "";
    }
  })();

  return (
    <FormStack gap="lg">
      <SettingsRow label={t("webSearch.enabledLabel")} layout="inline">
        <CheckboxField
          id="assistant-web-search-enabled"
          label={enabled ? t("shared.enabled") : t("shared.disabled")}
          checked={enabled}
          onChange={(event) => onEnabledChange(event.target.checked)}
          aria-label={t("webSearch.enabledAria")}
        />
      </SettingsRow>

      {enabled ? (
        <FormStack gap="md">
          <SettingsRow
            label={t("webSearch.providerLabel")}
            htmlFor="web-search-provider"
            help={
              nativeAvailable ? t("webSearch.providerHelpNative") : t("webSearch.providerHelpTool")
            }
          >
            <MenuSelect
              id="web-search-provider"
              variant="field"
              value={resolvedProvider}
              options={[
                ...(showAutoOption
                  ? [
                      {
                        value: "auto",
                        label: nativeAvailable
                          ? t("webSearch.providerAutoNative")
                          : t("webSearch.providerAutoTool"),
                      },
                    ]
                  : []),
                { value: "duckduckgo", label: t("webSearch.providerDuckDuckGo") },
                { value: "brave", label: t("webSearch.providerBrave") },
              ]}
              onChange={(value) => {
                onProviderChange(normalizeWebSearchProviderSetting(value));
              }}
              aria-label={t("webSearch.providerLabel")}
              data-testid="web-search-provider"
            />
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
        </FormStack>
      ) : (
        <p className={`mb-0 ${formHelpClass}`} data-testid="web-search-status">
          {t("webSearch.statusDisabled")}
        </p>
      )}
    </FormStack>
  );
}
