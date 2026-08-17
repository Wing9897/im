import { useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ToastContext } from "../context/ToastContext";
import {
  VOICE_REMINDER_SETTINGS_CHANGED_EVENT,
  hydrateVoiceReminderSettings,
  loadVoiceReminderSettings,
  saveVoiceReminderSettings,
  type NotifyFlashMode,
} from "../domain/notify/scanner/settings";

/** Shared voice/flash channel prefs for the notifications page and shell chrome. */
export function useNotifyChannelSettings() {
  const { t } = useTranslation("actions");
  const toast = useContext(ToastContext);
  const [settings, setSettings] = useState(() => loadVoiceReminderSettings());

  useEffect(() => {
    let cancelled = false;
    const sync = () => {
      if (!cancelled) {
        setSettings(loadVoiceReminderSettings());
      }
    };
    void hydrateVoiceReminderSettings().then(sync);
    window.addEventListener(VOICE_REMINDER_SETTINGS_CHANGED_EVENT, sync);
    return () => {
      cancelled = true;
      window.removeEventListener(VOICE_REMINDER_SETTINGS_CHANGED_EVENT, sync);
    };
  }, []);

  const patchChannel = (patch: {
    voiceEnabled?: boolean;
    flashEnabled?: boolean;
    flashMode?: NotifyFlashMode;
  }) => {
    const current = loadVoiceReminderSettings();
    const next = { ...current, ...patch };
    setSettings(next);
    void saveVoiceReminderSettings(next).then((ok) => {
      if (!ok) {
        toast?.showToast(t("voice.saveFailed"), "error");
        setSettings(loadVoiceReminderSettings());
      }
    });
  };

  return {
    voiceEnabled: settings.voiceEnabled,
    flashEnabled: settings.flashEnabled,
    flashMode: settings.flashMode,
    setVoiceEnabled: (voiceEnabled: boolean) => patchChannel({ voiceEnabled }),
    setFlashEnabled: (flashEnabled: boolean) => patchChannel({ flashEnabled }),
    setFlashMode: (flashMode: NotifyFlashMode) => patchChannel({ flashMode }),
  };
}
