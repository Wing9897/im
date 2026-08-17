import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SettingsSaveBar } from "../../components/settings/SettingsSaveBar";
import { useSettingsPageState } from "../../components/settings/useSettingsPageState";
import { ToggleSwitch } from "../../components/ToggleSwitch";
import { CollapsePanel, FieldLabel, SelectTile, SelectTileGrid } from "../../components/ui";
import { captionClass, cardTitleClass } from "../../components/ui/pageTypography";
import type { SystemSettingsSnapshot } from "../../types";

export const HOUSEHOLD_CAP_TOGGLES = [
  ["mcpCapCalendarRead", "calendarRead"],
  ["mcpCapCalendarWrite", "calendarWrite"],
  ["mcpCapMessagesSearch", "messagesSearch"],
  ["mcpCapIntelligenceSearch", "intelligenceSearch"],
  ["mcpCapItemsRead", "itemsRead"],
  ["mcpCapItemsWrite", "itemsWrite"],
] as const;

type HouseholdMasterSwitch = "mcp" | "a2a";

const MASTER_SWITCH = {
  mcp: {
    settingsKey: "mcpEnabled",
    labelKey: "mcpDocs.masterSwitch.label",
    helpKey: "mcpDocs.masterSwitch.help",
    inactiveKey: "mcpDocs.masterSwitch.capsInactive",
    testId: "mcp-master-switch",
    inactiveTestId: "mcp-caps-inactive-hint",
  },
  a2a: {
    settingsKey: "a2aEnabled",
    labelKey: "a2aDocs.masterSwitch.label",
    helpKey: "a2aDocs.masterSwitch.help",
    inactiveKey: "a2aDocs.masterSwitch.capsInactive",
    testId: "a2a-master-switch",
    inactiveTestId: "a2a-caps-inactive-hint",
  },
} as const satisfies Record<
  HouseholdMasterSwitch,
  {
    settingsKey: "mcpEnabled" | "a2aEnabled";
    labelKey: string;
    helpKey: string;
    inactiveKey: string;
    testId: string;
    inactiveTestId: string;
  }
>;

type SettingsHouseholdCapabilityTogglesProps = {
  /** Channel-specific HTTP master (independent). Caps stay shared across MCP and A2A. */
  masterSwitch?: HouseholdMasterSwitch;
};

export function SettingsHouseholdCapabilityToggles({
  masterSwitch,
}: SettingsHouseholdCapabilityTogglesProps) {
  const { t } = useTranslation("settings");
  const {
    settings,
    settingsInitialLoading,
    updateSettings,
    handleSave,
    saving,
    saveSuccess,
  } = useSettingsPageState();
  const [techNamesOpen, setTechNamesOpen] = useState(false);
  const master = masterSwitch ? MASTER_SWITCH[masterSwitch] : null;
  const masterEnabled = master ? Boolean(settings?.[master.settingsKey]) : true;

  return (
    <div>
      <h3 className={`m-0 ${cardTitleClass}`} title={t("mcpDocs.capabilityToggles.body")}>
        {t("mcpDocs.capabilityToggles.title")}
      </h3>
      <p className={`mt-xs mb-0 ${captionClass}`} data-testid="mcp-caps-shared-caption">
        {t("mcpDocs.capabilityToggles.sharedCaption")}
      </p>
      {settingsInitialLoading || !settings ? (
        <p className={`mt-sm mb-0 ${captionClass}`}>{t("mcpDocs.capabilityToggles.loading")}</p>
      ) : (
        <div className="mt-sm flex flex-col gap-sm" data-testid="mcp-capability-toggles">
          {master ? (
            <div className="flex min-w-0 flex-wrap items-center gap-md" title={t(master.helpKey)}>
              <FieldLabel className="mb-0">{t(master.labelKey)}</FieldLabel>
              <ToggleSwitch
                checked={masterEnabled}
                onChange={(next) => updateSettings(master.settingsKey, next)}
                label={t(master.labelKey)}
                showLabel={false}
                data-testid={master.testId}
              />
            </div>
          ) : null}
          {master && !masterEnabled ? (
            <p className={`m-0 ${captionClass}`} data-testid={master.inactiveTestId}>
              {t(master.inactiveKey)}
            </p>
          ) : null}
          <SelectTileGrid columns="repeat(auto-fit, minmax(160px, 1fr))" className="gap-sm">
            {HOUSEHOLD_CAP_TOGGLES.map(([key, i18nKey]) => {
              const checked = Boolean(settings[key as keyof SystemSettingsSnapshot]);
              const label = t(`mcpDocs.capabilityToggles.${i18nKey}`);
              const tools = t(`mcpDocs.capabilityToggles.${i18nKey}Tools`);
              return (
                <SelectTile
                  key={key}
                  compact
                  variant="toggle"
                  active={checked}
                  data-testid={`mcp-cap-${key}`}
                  aria-label={label}
                  title={tools}
                  onClick={() => updateSettings(key, !checked)}
                >
                  {label}
                </SelectTile>
              );
            })}
          </SelectTileGrid>
          <CollapsePanel
            nested
            title={t("mcpDocs.capabilityToggles.techNamesTitle")}
            open={techNamesOpen}
            onToggle={() => setTechNamesOpen((value) => !value)}
          >
            <ul className={`m-0 list-disc space-y-0.5 pl-4 ${captionClass}`} data-testid="mcp-cap-tech-names">
              {HOUSEHOLD_CAP_TOGGLES.map(([, i18nKey]) => (
                <li key={i18nKey}>
                  {t(`mcpDocs.capabilityToggles.${i18nKey}`)}
                  {" — "}
                  {t(`mcpDocs.capabilityToggles.${i18nKey}Tools`)}
                </li>
              ))}
            </ul>
          </CollapsePanel>
          <SettingsSaveBar
            saving={saving}
            saveSuccess={saveSuccess}
            saveLabel={t("mcpDocs.capabilityToggles.saveLabel")}
            onSave={handleSave}
          />
        </div>
      )}
    </div>
  );
}
