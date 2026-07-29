import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CheckboxField,
  FormStack,
  SelectField,
  SettingsRow,
  formHelpClass,
} from "../../components/ui";
import { CalendarTaskTargetSelect } from "../../components/assistant/CalendarTaskTargetSelect";
import { isAssistantDirectModeSupported } from "../../domain/assistant/directModeSupport";
import {
  createSpeechPorts,
  getSpeechLanguageOptions,
  getSttProviderOptions,
  getTtsProviderOptions,
  hydrateVoiceSettings,
  loadVoiceSettings,
  saveVoiceSettingsAsync,
  ttsSpeakOptionsFromVoiceSettings,
  type SpacePttMode,
  type SttProviderId,
  type TtsProviderId,
  type VoiceSettings,
} from "../../speech";
import { useBrowserTtsVoiceOptions } from "../../speech/useBrowserTtsVoiceOptions";
import { SettingsContentCard, SettingsFieldGroup } from "../settings/SettingsShared";

/**
 * Voice IO settings for the assistant (SQLite via /api/v1/ui-prefs/assistant/voice-io).
 * Only browser STT/TTS are wired in v1; reserved providers are omitted from the selects.
 */
export function SettingsVoicePage() {
  const { t } = useTranslation(["settings", "common"]);
  const [settings, setSettings] = useState<VoiceSettings>(() => loadVoiceSettings());
  const [previewing, setPreviewing] = useState(false);
  const voicePttSupported = isAssistantDirectModeSupported();

  useEffect(() => {
    void hydrateVoiceSettings().then((loaded) => {
      setSettings(loaded);
    });
  }, []);

  const sttOptions = getSttProviderOptions(t);
  const ttsOptions = getTtsProviderOptions(t);
  const languageOptions = getSpeechLanguageOptions(t);
  const voiceOptions = useBrowserTtsVoiceOptions(settings.speechLanguage);
  const browserSttOption = sttOptions.find((o) => o.id === "browser");
  const sttSelectValue = sttOptions.some((o) => o.id === settings.sttProvider)
    ? settings.sttProvider
    : "browser";
  const ttsSelectValue = ttsOptions.some((o) => o.id === settings.ttsProvider)
    ? settings.ttsProvider
    : "browser";

  const ttsVoiceSelectValue = useMemo(() => {
    if (!settings.ttsVoiceUri) return "";
    return voiceOptions.some((v) => v.voiceURI === settings.ttsVoiceUri)
      ? settings.ttsVoiceUri
      : "";
  }, [settings.ttsVoiceUri, voiceOptions]);

  const update = (patch: Partial<VoiceSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      void saveVoiceSettingsAsync(next);
      return next;
    });
  };

  const handleTtsPreview = () => {
    if (previewing) return;
    setPreviewing(true);
    const { tts } = createSpeechPorts({ ttsProvider: settings.ttsProvider });
    void tts
      .speak(String(t("voice.ttsPreviewSample")), ttsSpeakOptionsFromVoiceSettings(settings))
      .catch(() => {})
      .finally(() => setPreviewing(false));
  };

  return (
    <SettingsContentCard>
      <FormStack gap="lg">
        <p className={formHelpClass}>{t("voice.disclaimer")}</p>
        {!voicePttSupported || browserSttOption?.available === false ? (
          <p className={formHelpClass} data-testid="voice-stt-desktop-unavailable">
            {t("common:speech.sttDesktopUnavailable")}
          </p>
        ) : null}

        <SettingsFieldGroup>
          <SettingsRow
            label={t("voice.sttLabel")}
            htmlFor="voice-stt-provider"
            help={
              voicePttSupported ? t("voice.sttHelp") : t("voice.sttHelpDesktopBlocked")
            }
          >
            <SelectField
              id="voice-stt-provider"
              value={sttSelectValue}
              onChange={(e) => {
                const id = e.target.value as SttProviderId;
                const opt = sttOptions.find((o) => o.id === id);
                if (opt && !opt.available) return;
                update({ sttProvider: id });
              }}
            >
              {sttOptions.map((opt) => (
                <option key={opt.id} value={opt.id} disabled={!opt.available}>
                  {opt.label}
                </option>
              ))}
            </SelectField>
          </SettingsRow>

          <SettingsRow
            label={t("voice.ttsLabel")}
            htmlFor="voice-tts-provider"
            help={t("voice.ttsHelp")}
          >
            <SelectField
              id="voice-tts-provider"
              value={ttsSelectValue}
              onChange={(e) => {
                const id = e.target.value as TtsProviderId;
                const opt = ttsOptions.find((o) => o.id === id);
                if (opt && !opt.available) return;
                update({ ttsProvider: id });
              }}
            >
              {ttsOptions.map((opt) => (
                <option key={opt.id} value={opt.id} disabled={!opt.available}>
                  {opt.label}
                </option>
              ))}
            </SelectField>
          </SettingsRow>

          <SettingsRow label={t("voice.languageLabel")} htmlFor="voice-speech-language">
            <SelectField
              id="voice-speech-language"
              value={settings.speechLanguage}
              onChange={(e) => update({ speechLanguage: e.target.value })}
            >
              {languageOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </SelectField>
          </SettingsRow>

          {settings.ttsProvider === "browser" ? (
            <SettingsRow
              label={t("voice.ttsVoiceLabel")}
              htmlFor="voice-tts-voice"
              help={t("voice.ttsVoiceHelp")}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <SelectField
                  id="voice-tts-voice"
                  value={ttsVoiceSelectValue}
                  onChange={(e) => update({ ttsVoiceUri: e.target.value })}
                  data-testid="voice-tts-voice"
                  className="min-w-0 flex-1"
                >
                  <option value="">{t("voice.ttsVoiceDefault")}</option>
                  {voiceOptions.map((opt) => (
                    <option key={opt.voiceURI} value={opt.voiceURI}>
                      {opt.label}
                    </option>
                  ))}
                </SelectField>
                <button
                  type="button"
                  className="inline-flex shrink-0 items-center justify-center rounded-md border border-surface-border bg-surface-raised px-3 py-1.5 text-[12px] font-medium text-text-primary hover:bg-[color-mix(in_srgb,var(--text-primary)_6%,transparent)] disabled:opacity-50"
                  onClick={handleTtsPreview}
                  disabled={previewing}
                  data-testid="voice-tts-preview"
                >
                  {previewing ? t("voice.ttsPreviewing") : t("voice.ttsPreview")}
                </button>
              </div>
            </SettingsRow>
          ) : null}

          <SettingsRow
            label={t("voice.spacePttLabel")}
            htmlFor="voice-space-ptt-mode"
            help={
              voicePttSupported ? t("voice.spacePttHelp") : t("voice.spacePttHelpDesktopBlocked")
            }
          >
            <SelectField
              id="voice-space-ptt-mode"
              value={settings.spacePttMode}
              onChange={(e) => update({ spacePttMode: e.target.value as SpacePttMode })}
              data-testid="voice-space-ptt-mode"
            >
              <option value="hold">{t("voice.spacePttOptions.hold")}</option>
              <option value="toggle">{t("voice.spacePttOptions.toggle")}</option>
            </SelectField>
          </SettingsRow>

          <SettingsRow
            label={t("voice.defaultCalendarTaskLabel")}
            htmlFor="voice-default-calendar-task"
            help={t("voice.defaultCalendarTaskHelp")}
          >
            <CalendarTaskTargetSelect
              id="voice-default-calendar-task"
              value={settings.defaultCalendarTaskId}
              onChange={(taskId) => update({ defaultCalendarTaskId: taskId })}
              data-testid="voice-default-calendar-task"
            />
          </SettingsRow>

          <CheckboxField
            id="voice-tts-enabled"
            label={t("voice.autoSpeakLabel")}
            help={t("voice.autoSpeakHelp")}
            checked={settings.ttsEnabled}
            onChange={(e) => update({ ttsEnabled: e.target.checked })}
          />
        </SettingsFieldGroup>
      </FormStack>
    </SettingsContentCard>
  );
}
