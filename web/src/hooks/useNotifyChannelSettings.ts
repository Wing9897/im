import { useContext } from "react";
import { useTranslation } from "react-i18next";
import { ToastContext } from "../context/ToastContext";
import { type NotifyFlashMode } from "../domain/notify/scanner/settings";
import { useNotifySettings } from "./useNotifySettings";

/** Shared voice/flash channel prefs for the notifications page and shell chrome. */
export function useNotifyChannelSettings() {
  const { t } = useTranslation("actions");
  const toast = useContext(ToastContext);
  const { settings, setSettings, load, save } = useNotifySettings();

  const patchChannel = (patch: {
    voiceEnabled?: boolean;
    flashEnabled?: boolean;
    flashMode?: NotifyFlashMode;
  }) => {
    const current = load();
    const next = { ...current, ...patch };
    setSettings(next);
    void save(next).then((ok) => {
      if (!ok) {
        toast?.showToast(t("voice.saveFailed"), "error");
        setSettings(load());
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
