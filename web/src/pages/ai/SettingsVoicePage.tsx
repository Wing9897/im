import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CheckboxField,
  FormStack,
  MenuSelect,
  SelectField,
  SettingsRow,
  formHelpClass,
} from "../../components/ui";
import { WorksetTargetSelect } from "../../components/assistant/WorksetTargetSelect";
import { useToast } from "../../context/ToastContext";
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
  VOICE_SETTINGS_CHANGED_EVENT,
  type SpacePttMode,
  type SttProviderId,
  type TtsProviderId,
  type VoiceSettings,
} from "../../speech";
import { useBrowserTtsVoiceOptions } from "../../speech/useBrowserTtsVoiceOptions";
import {
  SettingsContentCard,
  SettingsFieldGroup,
} from "../../components/settings/SettingsFormLayout";

/**
 * Voice IO settings for the assistant (SQLite via /api/v1/ui-prefs/assistant/voice-io).
 * Only the browser STT/TTS provider is available.
 */
export function SettingsVoicePage() {
  const { t } = useTranslation(["settings", "common"]);
  const toast = useToast();
  const [settings, setSettings] = useState<VoiceSettings>(() => loadVoiceSettings());
  const [previewing, setPreviewing] = useState(false);
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
      .catch(() => {
        toast?.showToast(t("voice.ttsPreviewFailed"), "error");
      })
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
            {/* Native select: MenuSelect has no disabled-option support for unavailable providers. */}
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
            {/* Native select: MenuSelect has no disabled-option support for unavailable providers. */}
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
            <MenuSelect
              id="voice-speech-language"
              variant="field"
              value={settings.speechLanguage}
              options={languageOptions.map((opt) => ({
                value: opt.id,
                label: opt.label,
              }))}
              onChange={(next) => update({ speechLanguage: next })}
              aria-label={t("voice.languageLabel")}
            />
          </SettingsRow>

          {settings.ttsProvider === "browser" ? (
            <SettingsRow
              label={t("voice.ttsVoiceLabel")}
              htmlFor="voice-tts-voice"
              help={t("voice.ttsVoiceHelp")}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <MenuSelect
                  id="voice-tts-voice"
                  variant="field"
                  value={ttsVoiceSelectValue}
                  options={[
                    { value: "", label: t("voice.ttsVoiceDefault") },
                    ...voiceOptions.map((opt) => ({
                      value: opt.voiceURI,
                      label: opt.label,
                    })),
                  ]}
                  onChange={(next) => update({ ttsVoiceUri: next })}
                  data-testid="voice-tts-voice"
                  className="min-w-0 flex-1"
                  aria-label={t("voice.ttsVoiceLabel")}
                />
                <button
                  type="button"
                  className="im-surface-inset inline-flex shrink-0 items-center justify-center rounded-md border border-surface-border px-3 py-1.5 text-[12px] font-medium text-text-primary hover:bg-[color-mix(in_srgb,var(--text-primary)_6%,transparent)] disabled:opacity-50"
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
            <MenuSelect
              id="voice-space-ptt-mode"
              variant="field"
              value={settings.spacePttMode}
              options={[
                { value: "hold", label: t("voice.spacePttOptions.hold") },
                { value: "toggle", label: t("voice.spacePttOptions.toggle") },
              ]}
              onChange={(next) => update({ spacePttMode: next as SpacePttMode })}
              data-testid="voice-space-ptt-mode"
              aria-label={t("voice.spacePttLabel")}
            />
          </SettingsRow>

          <SettingsRow
            label={t("voice.defaultWorksetLabel")}
            htmlFor="voice-default-calendar-workset"
            help={t("voice.defaultWorksetHelp")}
          >
            <WorksetTargetSelect
              id="voice-default-calendar-workset"
              value={settings.defaultWorksetId}
              onChange={(taskId) => update({ defaultWorksetId: taskId })}
              data-testid="voice-default-calendar-workset"
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
