import { useTranslation } from "react-i18next";
import { SettingsSaveBar } from "../../components/settings/SettingsSaveBar";
import { CheckboxField, FormStack, SettingsRow } from "../../components/ui";
import { captionClass, cardBodyClass, cardTitleClass } from "../../components/ui/pageTypography";
import type { SystemSettingsSnapshot } from "../../types";
import { SettingsFieldGroup } from "./SettingsShared";

/** Settings wire key + i18n suffix under ``mcpDocs.capabilityToggles.*``. */
export const MCP_CAP_TOGGLES = [
  ["mcpCapCalendarRead", "calendarRead"],
  ["mcpCapCalendarWrite", "calendarWrite"],
  ["mcpCapMessagesSearch", "messagesSearch"],
  ["mcpCapIntelligenceSearch", "intelligenceSearch"],
  ["mcpCapItemsRead", "itemsRead"],
  ["mcpCapItemsWrite", "itemsWrite"],
] as const;

type McpCapKey = (typeof MCP_CAP_TOGGLES)[number][0];

function enabledLabel(t: (key: string) => string, on: boolean): string {
  return on ? t("shared.enabled") : t("shared.disabled");
}

type SettingsMcpCapabilityTogglesProps = {
  settings: SystemSettingsSnapshot | null;
  settingsInitialLoading: boolean;
  updateSettings: <K extends keyof SystemSettingsSnapshot>(
    key: K,
    value: SystemSettingsSnapshot[K],
  ) => void;
  handleSave: () => void | Promise<void>;
  saving: boolean;
  saveSuccess: boolean;
};

/** Master switch + per-capability toggles + save bar. */
export function SettingsMcpCapabilityToggles({
  settings,
  settingsInitialLoading,
  updateSettings,
  handleSave,
  saving,
  saveSuccess,
}: SettingsMcpCapabilityTogglesProps) {
  const { t } = useTranslation("settings");
  const mcpEnabled = Boolean(settings?.mcpEnabled);
  const capsDisabled = !mcpEnabled;

  return (
    <SettingsFieldGroup showDivider>
      <div>
        <h3 className={`m-0 ${cardTitleClass}`}>{t("mcpDocs.capabilityToggles.title")}</h3>
        <p className={`mt-xs mb-0 ${cardBodyClass}`}>{t("mcpDocs.capabilityToggles.body")}</p>
        {settingsInitialLoading || !settings ? (
          <p className={`mt-sm mb-0 ${captionClass}`}>{t("mcpDocs.capabilityToggles.loading")}</p>
        ) : (
          <div className="mt-sm" data-testid="mcp-capability-toggles">
            <FormStack>
              <SettingsRow
                label={t("mcpDocs.masterSwitch.label")}
                help={t("mcpDocs.masterSwitch.help")}
              >
                <CheckboxField
                  label={enabledLabel(t, mcpEnabled)}
                  checked={mcpEnabled}
                  onChange={(e) => updateSettings("mcpEnabled", e.target.checked)}
                  data-testid="mcp-master-switch"
                  aria-label={t("mcpDocs.masterSwitch.label")}
                />
              </SettingsRow>
              {capsDisabled ? (
                <p className={`m-0 ${captionClass}`} data-testid="mcp-caps-inactive-hint">
                  {t("mcpDocs.masterSwitch.capsInactive")}
                </p>
              ) : null}
              {MCP_CAP_TOGGLES.map(([key, i18nKey]) => {
                const checked = Boolean(settings[key as keyof SystemSettingsSnapshot]);
                const label = t(`mcpDocs.capabilityToggles.${i18nKey}`);
                return (
                  <SettingsRow
                    key={key}
                    label={label}
                    help={t(`mcpDocs.capabilityToggles.${i18nKey}Help`)}
                  >
                    <CheckboxField
                      label={enabledLabel(t, checked)}
                      checked={checked}
                      disabled={capsDisabled}
                      onChange={(e) => updateSettings(key as McpCapKey, e.target.checked)}
                      data-testid={`mcp-cap-${key}`}
                      aria-label={label}
                    />
                  </SettingsRow>
                );
              })}
              <SettingsSaveBar
                saving={saving}
                saveSuccess={saveSuccess}
                saveLabel={t("mcpDocs.capabilityToggles.saveLabel")}
                onSave={handleSave}
              />
            </FormStack>
          </div>
        )}
      </div>
    </SettingsFieldGroup>
  );
}
