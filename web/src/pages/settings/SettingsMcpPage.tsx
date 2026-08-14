import { useTranslation } from "react-i18next";
import { resolveBaseUrl } from "../../api/baseUrl";
import { cardBodyClass } from "../../components/ui/pageTypography";
import { useSettingsPageState } from "../../components/settings/useSettingsPageState";
import { SettingsContentCard } from "./SettingsShared";
import { SettingsMcpCapabilityToggles } from "./SettingsMcpCapabilityToggles";
import {
  SettingsMcpOpenClawSection,
  SettingsMcpReferenceDocs,
} from "./SettingsMcpDocsSections";
import { SettingsMcpProbeSection } from "./SettingsMcpProbeSection";

/** Settings → MCP: probe + toggles first; long docs collapsed. */
export function SettingsMcpPage() {
  const { t } = useTranslation("settings");
  const {
    settings,
    settingsInitialLoading,
    updateSettings,
    handleSave,
    saving,
    saveSuccess,
  } = useSettingsPageState();
  const mcpUrl = `${resolveBaseUrl()}/api/v1/mcp`;

  return (
    <SettingsContentCard>
      <p className={`m-0 ${cardBodyClass}`}>{t("mcpDocs.intro")}</p>
      <SettingsMcpProbeSection mcpUrl={mcpUrl} />
      <SettingsMcpCapabilityToggles
        settings={settings}
        settingsInitialLoading={settingsInitialLoading}
        updateSettings={updateSettings}
        handleSave={handleSave}
        saving={saving}
        saveSuccess={saveSuccess}
      />
      <SettingsMcpOpenClawSection mcpUrl={mcpUrl} />
      <SettingsMcpReferenceDocs />
    </SettingsContentCard>
  );
}
