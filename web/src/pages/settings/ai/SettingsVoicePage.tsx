import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FormGrid, formHelpClass } from "../../../components/ui";
import { isAssistantDirectModeSupported } from "../../../domain/assistant/directModeSupport";
import {
  getSttProviderOptions,
  hydrateVoiceSettings,
  loadVoiceSettings,
  saveVoiceSettingsAsync,
  VOICE_SETTINGS_CHANGED_EVENT,
  type SpacePttMode,
  type SttProviderId,
  type VoiceSettings,
} from "../../../speech";
import {
  SettingsContentCard,
  SettingsFieldGroup,
} from "../../../components/settings/SettingsFormLayout";
import { SettingsVoicePttSection } from "./SettingsVoicePttSection";
import { SettingsVoiceSttSection } from "./SettingsVoiceSttSection";
import {
  SettingsVoiceAutoSpeakSection,
  SettingsVoiceTtsSection,
} from "./SettingsVoiceTtsSection";
import { SettingsVoiceWorksetSection } from "./SettingsVoiceWorksetSection";

/**
 * Voice IO settings for the assistant (SQLite via /api/v1/ui-prefs/assistant/voice-io).
 * Only the browser STT/TTS provider is available.
 */
export function SettingsVoicePage() {
  const { t } = useTranslation(["settings", "common"]);
  const [settings, setSettings] = useState<VoiceSettings>(() => loadVoiceSettings());
  const voicePttSupported = isAssistantDirectModeSupported();

  useEffect(() => {
    void hydrateVoiceSettings().then((loaded) => {
      setSettings(loaded);
    });
  }, []);

  useEffect(() => {
    const sync = () => setSettings(loadVoiceSettings());
    window.addEventListener(VOICE_SETTINGS_CHANGED_EVENT, sync);
    return () => window.removeEventListener(VOICE_SETTINGS_CHANGED_EVENT, sync);
  }, []);

  const browserSttOption = getSttProviderOptions(t).find((o) => o.id === "browser");

  const update = (patch: Partial<VoiceSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      void saveVoiceSettingsAsync(next);
      return next;
    });
  };

  return (
    <SettingsContentCard>
      <p className={formHelpClass}>{t("voice.disclaimer")}</p>
      {!voicePttSupported || browserSttOption?.available === false ? (
        <p className={formHelpClass} data-testid="voice-stt-desktop-unavailable">
          {t("common:speech.sttDesktopUnavailable")}
        </p>
      ) : null}

      <SettingsFieldGroup>
        <FormGrid>
          <SettingsVoiceSttSection
            sttProvider={settings.sttProvider}
            voicePttSupported={voicePttSupported}
            onSttProviderChange={(next: SttProviderId) => update({ sttProvider: next })}
          />
          <SettingsVoiceTtsSection settings={settings} onUpdate={update} />
        </FormGrid>

        <SettingsVoiceAutoSpeakSection
          ttsEnabled={settings.ttsEnabled}
          onTtsEnabledChange={(next) => update({ ttsEnabled: next })}
        />

        <SettingsVoicePttSection
          speechLanguage={settings.speechLanguage}
          spacePttMode={settings.spacePttMode}
          voicePttSupported={voicePttSupported}
          onSpeechLanguageChange={(next) => update({ speechLanguage: next })}
          onSpacePttModeChange={(next: SpacePttMode) => update({ spacePttMode: next })}
        >
          <SettingsVoiceWorksetSection
            defaultWorksetId={settings.defaultWorksetId}
            onDefaultWorksetIdChange={(defaultWorksetId) =>
              setSettings((prev) => ({ ...prev, defaultWorksetId }))
            }
          />
        </SettingsVoicePttSection>
      </SettingsFieldGroup>
    </SettingsContentCard>
  );
}
