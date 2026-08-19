import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "../../../context/ToastContext";
import { createSpeechPorts, loadVoiceSettings, ttsSpeakOptionsFromVoiceSettings } from "../../../speech";
import { buildPreviewSpeakText } from "../../../domain/notify/scanner/scanner";
import { announceNotify } from "../../../domain/notify/scanner/announce";
import { type NotifySettings } from "../../../domain/notify/scanner/settings";
import { useNotifySettings } from "../../../hooks/useNotifySettings";

/** State + handlers for the Actions → local notifications panel. */
export function useLocalNotifyPanelState() {
  const { t } = useTranslation("actions");
  const toast = useToast();
  const { settings, setSettings, load, save } = useNotifySettings();
  const [previewing, setPreviewing] = useState(false);

  const update = (patch: Partial<NotifySettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      void save(next).then((ok) => {
        if (!ok) {
          toast?.showToast(t("voice.saveFailed"), "error");
          setSettings(prev);
          return;
        }
        setSettings(load());
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
    void announceNotify(tts, buildPreviewSpeakText(lead), {
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
