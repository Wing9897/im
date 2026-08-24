import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FormStack, MenuSelect, SettingsRow } from "../../components/ui";
import { ToggleSwitch } from "../../components/ToggleSwitch";
import { useToast } from "../../context/ToastContext";
import {
  createSpeechPorts,
  getTtsProviderOptions,
  ttsSpeakOptionsFromVoiceSettings,
  type TtsProviderId,
  type VoiceSettings,
} from "../../speech";
import { TTS_VOICE_PICKER_SEARCH_MIN } from "../../speech/browserTtsVoices";
import { useBrowserTtsVoiceOptions } from "../../speech/useBrowserTtsVoiceOptions";
import {
  VoicePrefCard,
  VoiceProviderMenuSelect,
  VoiceSelectWrap,
} from "./SettingsVoiceShared";

type Props = {
  settings: VoiceSettings;
  onUpdate: (patch: Partial<VoiceSettings>) => void;
};

export function SettingsVoiceTtsSection({ settings, onUpdate }: Props) {
  const { t } = useTranslation("settings");
  const toast = useToast();
  const [previewing, setPreviewing] = useState(false);
  const ttsOptions = getTtsProviderOptions(t);
  const voiceOptions = useBrowserTtsVoiceOptions(settings.speechLanguage);
  const ttsSelectValue = ttsOptions.some((o) => o.id === settings.ttsProvider)
    ? settings.ttsProvider
    : "browser";

  const ttsVoiceSelectValue = useMemo(() => {
    if (!settings.ttsVoiceUri) return "";
    return voiceOptions.some((v) => v.voiceURI === settings.ttsVoiceUri)
      ? settings.ttsVoiceUri
      : "";
  }, [settings.ttsVoiceUri, voiceOptions]);

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
    <VoicePrefCard title={t("voice.ttsSectionTitle")} testId="voice-tts-card">
      <FormStack gap="md">
        <SettingsRow
          layout="inline"
          label={t("voice.ttsLabel")}
          htmlFor="voice-tts-provider"
          help={t("voice.ttsHelp")}
        >
          <VoiceProviderMenuSelect
            id="voice-tts-provider"
            value={ttsSelectValue}
            options={ttsOptions}
            onChange={(next) => onUpdate({ ttsProvider: next as TtsProviderId })}
            testId="voice-tts-provider"
            ariaLabel={t("voice.ttsLabel")}
          />
        </SettingsRow>

        {settings.ttsProvider === "browser" ? (
          <SettingsRow
            layout="inline"
            label={t("voice.ttsVoiceLabel")}
            htmlFor="voice-tts-voice"
            help={`${t("voice.ttsVoiceHelp")} ${t("voice.ttsVoicePlatformHelp")}`}
          >
            <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
              <VoiceSelectWrap>
                <MenuSelect
                  id="voice-tts-voice"
                  variant="field"
                  menuPortal
                  searchable={voiceOptions.length >= TTS_VOICE_PICKER_SEARCH_MIN}
                  searchPlaceholder={t("voice.ttsVoiceSearchPlaceholder")}
                  searchEmptyLabel={t("voice.ttsVoiceSearchEmpty")}
                  value={ttsVoiceSelectValue}
                  options={[
                    { value: "", label: t("voice.ttsVoiceDefault") },
                    ...voiceOptions.map((opt) => ({
                      value: opt.voiceURI,
                      label: opt.label,
                      group: opt.lang,
                      title: opt.label,
                    })),
                  ]}
                  onChange={(next) => onUpdate({ ttsVoiceUri: next })}
                  data-testid="voice-tts-voice"
                  aria-label={t("voice.ttsVoiceLabel")}
                />
              </VoiceSelectWrap>
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
      </FormStack>
    </VoicePrefCard>
  );
}

export function SettingsVoiceAutoSpeakSection({
  ttsEnabled,
  onTtsEnabledChange,
}: {
  ttsEnabled: boolean;
  onTtsEnabledChange: (next: boolean) => void;
}) {
  const { t } = useTranslation("settings");

  return (
    <VoicePrefCard title={t("voice.autoSpeakLabel")} testId="voice-auto-speak-card">
      <div className="min-w-0" title={t("voice.autoSpeakHelp")}>
        <SettingsRow layout="inline" label={t("voice.autoSpeakLabel")} help={t("voice.autoSpeakHelp")}>
          <ToggleSwitch
            checked={ttsEnabled}
            onChange={onTtsEnabledChange}
            label={t("voice.autoSpeakLabel")}
            showLabel={false}
            data-testid="voice-tts-enabled"
          />
        </SettingsRow>
      </div>
    </VoicePrefCard>
  );
}
