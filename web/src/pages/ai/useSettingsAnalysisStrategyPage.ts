import { useCallback } from "react";
import {
  normalizeEvidenceStyle,
  type EvidenceStyle,
} from "../../domain/settings/analysisEvidenceStyle";
import { useSettingsPageState } from "../settings/SettingsShared";

export function useSettingsAnalysisStrategyPage() {
  const {
    settingsObject,
    settingsInitialLoading,
    error,
    saving,
    saveSuccess,
    handleSettingChange,
    handleSave: saveSettings,
  } = useSettingsPageState();

  const evidenceStyle: EvidenceStyle = normalizeEvidenceStyle(
    settingsObject?.analysisStrategyMode,
  );

  const handleSave = useCallback(async () => {
    await saveSettings({ requireProviderConfig: false });
  }, [saveSettings]);

  return {
    settingsObject,
    settingsInitialLoading,
    error,
    saving,
    saveSuccess,
    handleSettingChange,
    handleSave,
    evidenceStyle,
  };
}
