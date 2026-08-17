import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "../../../context/ToastContext";
import { createSpeechPorts, loadVoiceSettings, ttsSpeakOptionsFromVoiceSettings } from "../../../speech";
import { buildPreviewSpeakText } from "../../../domain/notify/scanner/scanner";
import { announceVoiceReminder } from "../../../domain/notify/scanner/announce";
import {
  VOICE_REMINDER_SETTINGS_CHANGED_EVENT,
  hydrateVoiceReminderSettings,
  loadVoiceReminderSettings,
  saveVoiceReminderSettings,
  type VoiceReminderSettings,
} from "../../../domain/notify/scanner/settings";

/** State + handlers for the Actions → local notifications panel. */
export function useLocalNotifyPanelState() {
  const { t } = useTranslation("actions");
  const toast = useToast();
  const [settings, setSettings] = useState<VoiceReminderSettings>(() =>
    loadVoiceReminderSettings(),
  );
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void hydrateVoiceReminderSettings().then((loaded) => {
      if (!cancelled) {
        setSettings(loaded);
      }
    });
    const sync = () => {
      if (!cancelled) {
        setSettings(loadVoiceReminderSettings());
      }
    };
    window.addEventListener(VOICE_REMINDER_SETTINGS_CHANGED_EVENT, sync);
    return () => {
      cancelled = true;
      window.removeEventListener(VOICE_REMINDER_SETTINGS_CHANGED_EVENT, sync);
    };
  }, []);

  const update = (patch: Partial<VoiceReminderSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      void saveVoiceReminderSettings(next).then((ok) => {
        if (!ok) {
          toast?.showToast(t("voice.saveFailed"), "error");
          setSettings(prev);
          return;
        }
        setSettings(loadVoiceReminderSettings());
      });
      return next;
    });
  };

  const handlePreview = () => {
    if (previewing) {
      return;
    }
    setPreviewing(true);
    const voice = loadVoiceSettings();
    const { tts } = createSpeechPorts();
    const lead = settings.leadOffsetsMinutes[0] ?? 60;
    void announceVoiceReminder(tts, buildPreviewSpeakText(lead), {
      ...ttsSpeakOptionsFromVoiceSettings(voice),
    })
      .catch(() => {
        toast?.showToast(t("voice.previewFailed"), "error");
      })
      .finally(() => setPreviewing(false));
  };

  return {
    settings,
    update,
    previewing,
    handlePreview,
  };
}
