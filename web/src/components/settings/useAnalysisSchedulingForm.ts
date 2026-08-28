import { useCallback } from "react";
import {
  normalizeEvidenceStyle,
  type EvidenceStyle,
} from "../../domain/settings/analysisEvidenceStyle";
import { useSystemSettingsPage } from "../../hooks/useSystemSettingsPage";

export function useAnalysisSchedulingForm() {
  const {
    settingsObject,
    settingsInitialLoading,
    error,
    saving,
    saveSuccess,
    handleSettingChange,
    handleSave: saveSettings,
    reloadSettings,
    settings,
    savedSnapshot,
    showConcurrentBatchesWarning,
    confirmConcurrentBatchesSave,
    cancelConcurrentBatchesSave,
  } = useSystemSettingsPage();

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
    settings,
    savedSnapshot,
    showConcurrentBatchesWarning,
    confirmConcurrentBatchesSave,
    cancelConcurrentBatchesSave,
  };
}
