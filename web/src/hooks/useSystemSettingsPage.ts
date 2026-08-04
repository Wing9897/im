import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  fetchSystemSettings,
  saveSystemSettings,
} from "../api/config";
import { requestDatabaseReset } from "../api/system";
import { useCollectorStatus } from "../context/CollectorStatusContext";
import { relaunchAfterDestructiveReset } from "../electron/electronConnection";
import type {
  SettingsKey,
  SettingsObject,
  SystemSettingsSnapshot,
} from "../types";
import { toErrorMessage } from "../utils/errors";
import {
  getActiveProviderConfig,
  buildSettingsObject,
  shouldShowConcurrentBatchesWarning,
  mergePersistedSnapshot,
  toPersistableSettings,
} from "../domain/settings/systemSettingsHelpers";

export type SystemSettingsPageState = ReturnType<typeof useSystemSettingsPage>;

/** Settings persisted verbatim as strings (no provider-specific mapping). */
const DIRECT_STRING_SETTINGS_KEYS: ReadonlySet<SettingsKey> = new Set([
  "analysisBatchMessageLimit",
  "analysisMaxTotalChars",
  "analysisMaxEstimatedInputTokens",
  "llmGenerationTimeout",
  "maxBatchRetries",
  "maxConcurrentBatches",
  "analysisStrategyMode",
  "analysisTriggerThreshold",
] as SettingsKey[]);

export function useSystemSettingsPage() {
  const { t } = useTranslation("settings");
  const { requestAiStatusRefresh } = useCollectorStatus();
  const [settings, setSettings] = useState<SystemSettingsSnapshot | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState<SystemSettingsSnapshot | null>(null);
  const [saving, setSaving] = useState(false);
  const [resettingRuntimeData, setResettingRuntimeData] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConcurrentBatchesWarning, setShowConcurrentBatchesWarning] = useState(false);
  const saveSuccessTimerRef = useRef<number | null>(null);

  const clearSaveSuccessTimer = useCallback(() => {
    if (saveSuccessTimerRef.current !== null) {
      window.clearTimeout(saveSuccessTimerRef.current);
      saveSuccessTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const snapshot = await fetchSystemSettings();
        if (!cancelled) {
          setSettings(snapshot);
          setSavedSnapshot(snapshot);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(toErrorMessage(e));
        }
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => clearSaveSuccessTimer, [clearSaveSuccessTimer]);

  const updateSettings = useCallback(
    <K extends keyof SystemSettingsSnapshot>(
      key: K,
      value: SystemSettingsSnapshot[K],
    ) => {
      setSettings((current) =>
        current ? { ...current, [key]: value } : current,
      );
    },
    [],
  );

  const applyPersistedSnapshot = useCallback((normalized: SystemSettingsSnapshot) => {
    setSettings((current) =>
      current ? mergePersistedSnapshot(current, normalized) : normalized,
    );
    setSavedSnapshot((current) =>
      current ? mergePersistedSnapshot(current, normalized) : normalized,
    );
  }, []);

  const executeSave = useCallback(async (options?: {
    requireProviderConfig?: boolean;
    patch?: Partial<SystemSettingsSnapshot>;
  }) => {
    if (!settings) {
      return;
    }

    const snapshot = options?.patch ? { ...settings, ...options.patch } : settings;
    if (options?.patch) {
      setSettings(snapshot);
    }

    const requireProviderConfig = options?.requireProviderConfig !== false;
    if (requireProviderConfig) {
      const activeConfig = getActiveProviderConfig(snapshot, t);

      if (!activeConfig.baseUrl.trim()) {
        setError(activeConfig.fields.emptyBaseUrlMessage);
        setSaveSuccess(false);
        return;
      }
      if (!activeConfig.model.trim()) {
        setError(activeConfig.fields.emptyModelMessage);
        setSaveSuccess(false);
        return;
      }
    }

    setSaving(true);
    setSaveSuccess(false);
    setError(null);
    clearSaveSuccessTimer();
    try {
      const normalized = await saveSystemSettings(toPersistableSettings(snapshot));
      setSettings(normalized);
      setSavedSnapshot(normalized);
      requestAiStatusRefresh(true);
      setSaveSuccess(true);
      saveSuccessTimerRef.current = window.setTimeout(() => {
        saveSuccessTimerRef.current = null;
        setSaveSuccess(false);
      }, 3000);
    } catch (e) {
      setError(toErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }, [settings, clearSaveSuccessTimer, requestAiStatusRefresh, t]);

  const handleSave = async (options?: {
    requireProviderConfig?: boolean;
    patch?: Partial<SystemSettingsSnapshot>;
  }) => {
    if (!settings || !savedSnapshot) {
      return;
    }

    const pendingMax = options?.patch?.maxConcurrentBatches ?? settings.maxConcurrentBatches;
    if (
      shouldShowConcurrentBatchesWarning(
        pendingMax,
        savedSnapshot.maxConcurrentBatches,
      )
    ) {
      setShowConcurrentBatchesWarning(true);
      return;
    }

    await executeSave(options);
  };

  const confirmConcurrentBatchesSave = useCallback(async () => {
    setShowConcurrentBatchesWarning(false);
    await executeSave({ requireProviderConfig: true });
  }, [executeSave]);

  const cancelConcurrentBatchesSave = useCallback(() => {
    setShowConcurrentBatchesWarning(false);
    if (savedSnapshot) {
      setSettings((current) =>
        current
          ? { ...current, maxConcurrentBatches: savedSnapshot.maxConcurrentBatches }
          : current,
      );
    }
  }, [savedSnapshot]);

  const handleRequestFullReset = useCallback(async () => {
    setResettingRuntimeData(true);
    setError(null);
    try {
      await requestDatabaseReset();
      // Wipe client state + Desktop relaunch / browser reload → FirstRunWizard.
      await relaunchAfterDestructiveReset();
    } catch (e) {
      setError(toErrorMessage(e));
      setResettingRuntimeData(false);
    }
  }, []);

  const activeProviderConfig = settings
    ? getActiveProviderConfig(settings, t)
    : null;

  const settingsObject = useMemo<SettingsObject | null>(() => {
    if (!settings || !activeProviderConfig) return null;
    return buildSettingsObject(settings, activeProviderConfig);
  }, [settings, activeProviderConfig]);

  const handleSettingChange = useCallback(
    <K extends SettingsKey>(key: K, value: SettingsObject[K]) => {
      if (!settings) return;
      const config = getActiveProviderConfig(settings, t);

      const settingHandlers: Record<string, () => void> = {
        llmProvider: () => updateSettings("llmProvider", value as SystemSettingsSnapshot["llmProvider"]),
        llmBaseUrl: () => updateSettings(config.fields.baseUrlKey, value as string),
        llmModel: () => updateSettings(config.fields.modelKey, value as string),
        llmApiKey: () => { if (config.fields.apiKeyKey) updateSettings(config.fields.apiKeyKey, value as string); },
        openaiJsonMode: () => updateSettings("openaiJsonMode", value as string),
        ollamaThinkingEnabled: () =>
          updateSettings("ollamaThinkingEnabled", value as boolean),
        analysisTraceVerbose: () => updateSettings("analysisTraceVerbose", value as boolean),
        autoPauseOnRetriesExhausted: () =>
          updateSettings("autoPauseOnRetriesExhausted", value as boolean),
      };

      const handler = settingHandlers[key];
      if (handler) {
        handler();
      } else if (DIRECT_STRING_SETTINGS_KEYS.has(key)) {
        updateSettings(key as keyof SystemSettingsSnapshot, value as string);
      }
    },
    [settings, updateSettings, t],
  );

  const hasUnsavedChanges = useMemo(() => {
    if (!settings || !savedSnapshot) return false;
    return JSON.stringify(settings) !== JSON.stringify(savedSnapshot);
  }, [settings, savedSnapshot]);

  return {
    settings,
    settingsInitialLoading: settings === null && error === null,
    savedSnapshot,
    activeProviderConfig,
    settingsObject,
    saving,
    resettingRuntimeData,
    saveSuccess,
    error,
    hasUnsavedChanges,
    showConcurrentBatchesWarning,
    updateSettings,
    applyPersistedSnapshot,
    handleSettingChange,
    handleSave,
    handleRequestFullReset,
    confirmConcurrentBatchesSave,
    cancelConcurrentBatchesSave,
  };
}
