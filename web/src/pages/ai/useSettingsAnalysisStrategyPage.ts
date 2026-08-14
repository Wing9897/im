import { useCallback } from "react";
import {
  normalizeEvidenceStyle,
  type EvidenceStyle,
} from "../../domain/settings/analysisEvidenceStyle";
import { useSettingsPageState } from "../../components/settings/useSettingsPageState";

export function useSettingsAnalysisStrategyPage() {
  const {
    settingsObject,
    settingsInitialLoading,
    error,
    saving,
    saveSuccess,
    handleSettingChange,
    handleSave: saveSettings,
    reloadSettings,
  } = useSettingsPageState();

  const evidenceStyle: EvidenceStyle = normalizeEvidenceStyle(
    settingsObject?.analysisStrategyMode,
  );

  const handleSave = useCallback(async () => {
    await saveSettings();
  }, [saveSettings]);

  return {
    settingsObject,
    settingsInitialLoading,
    error,
    saving,
    saveSuccess,
    handleSettingChange,
    handleSave,
    reloadSettings,
    evidenceStyle,
  };
}
