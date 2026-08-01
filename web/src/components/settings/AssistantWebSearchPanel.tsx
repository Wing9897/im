import { useTranslation } from "react-i18next";
import { CheckboxField, FormStack, PasswordField, SelectField, SettingsRow } from "../ui";
import { formHelpClass } from "../ui/pageTypography";

export type WebSearchProvider = "duckduckgo" | "brave";

interface AssistantWebSearchPanelProps {
  enabled: boolean;
  provider: string;
  braveApiKey: string;
  onEnabledChange: (value: boolean) => void;
  onProviderChange: (value: WebSearchProvider) => void;
  onBraveApiKeyChange: (value: string) => void;
}

export function AssistantWebSearchPanel({
  enabled,
  provider,
  braveApiKey,
  onEnabledChange,
  onProviderChange,
  onBraveApiKeyChange,
}: AssistantWebSearchPanelProps) {
  const { t } = useTranslation("settings");
  const resolvedProvider: WebSearchProvider =
    provider === "brave" ? "brave" : "duckduckgo";

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
              onChange={(event) =>
                onProviderChange(
                  event.target.value === "brave" ? "brave" : "duckduckgo",
                )
              }
            >
              <option value="duckduckgo">{t("webSearch.providerDuckDuckGo")}</option>
              <option value="brave">{t("webSearch.providerBrave")}</option>
            </SelectField>
          </SettingsRow>

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
          ) : (
            <p className={`mb-0 ${formHelpClass}`}>{t("webSearch.duckDuckGoNote")}</p>
          )}
        </>
      ) : null}
    </FormStack>
  );
}
