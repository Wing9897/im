import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  FormGrid,
  FormStack,
  MenuSelect,
  SettingsRow,
  SurfaceCard,
  formHelpClass,
} from "../../components/ui";
import { ToggleSwitch } from "../../components/ToggleSwitch";
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
  persistAssistantDefaultWorksetId,
  saveVoiceSettingsAsync,
  ttsSpeakOptionsFromVoiceSettings,
  VOICE_SETTINGS_CHANGED_EVENT,
  type SpacePttMode,
  type SttProviderId,
  type TtsProviderId,
  type VoiceSettings,
} from "../../speech";
import { useBrowserTtsVoiceOptions } from "../../speech/useBrowserTtsVoiceOptions";
import { TTS_VOICE_PICKER_SEARCH_MIN } from "../../speech/browserTtsVoices";
import {
  SettingsContentCard,
  SettingsFieldGroup,
} from "../../components/settings/SettingsFormLayout";

function VoicePrefCard({
  title,
  testId,
  children,
}: {
  title: string;
  testId: string;
  children: ReactNode;
}) {
  return (
    <SurfaceCard
      material="panel"
      density="compact"
      role="region"
      aria-label={title}
      data-testid={testId}
    >
      {children}
    </SurfaceCard>
  );
}

const VOICE_SELECT_WRAP = "w-[16rem] max-w-full shrink-0";

function VoiceSelectWrap({ children }: { children: ReactNode }) {
  return <div className={VOICE_SELECT_WRAP}>{children}</div>;
}

type VoiceChoice = { id: string; label: string; available?: boolean };

function VoiceProviderMenuSelect({
  id,
  value,
  options,
  onChange,
  testId,
  ariaLabel,
}: {
  id: string;
  value: string;
  options: readonly VoiceChoice[];
  onChange: (value: string) => void;
  testId?: string;
  ariaLabel: string;
}) {
  return (
    <VoiceSelectWrap>
      <MenuSelect
        id={id}
        variant="field"
        menuPortal
        value={value}
        options={options.map((opt) => ({
          value: opt.id,
          label: opt.label,
          disabled: opt.available === false,
        }))}
        onChange={(next) => {
          const opt = options.find((o) => o.id === next);
          if (opt?.available === false) return;
          onChange(next);
        }}
        data-testid={testId}
        aria-label={ariaLabel}
      />
    </VoiceSelectWrap>
  );
}

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
      <p className={formHelpClass}>{t("voice.disclaimer")}</p>
      {!voicePttSupported || browserSttOption?.available === false ? (
        <p className={formHelpClass} data-testid="voice-stt-desktop-unavailable">
          {t("common:speech.sttDesktopUnavailable")}
        </p>
      ) : null}

      <SettingsFieldGroup>
        <FormGrid>
          <VoicePrefCard title={t("voice.sttSectionTitle")} testId="voice-stt-card">
            <SettingsRow
              layout="inline"
              label={t("voice.sttLabel")}
              htmlFor="voice-stt-provider"
              help={
                voicePttSupported ? t("voice.sttHelp") : t("voice.sttHelpDesktopBlocked")
              }
            >
              <VoiceProviderMenuSelect
                id="voice-stt-provider"
                value={sttSelectValue}
                options={sttOptions}
                onChange={(next) => update({ sttProvider: next as SttProviderId })}
                testId="voice-stt-provider"
                ariaLabel={t("voice.sttLabel")}
              />
            </SettingsRow>
          </VoicePrefCard>

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
                  onChange={(next) => update({ ttsProvider: next as TtsProviderId })}
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
                        onChange={(next) => update({ ttsVoiceUri: next })}
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
        </FormGrid>

        <VoicePrefCard title={t("voice.autoSpeakLabel")} testId="voice-auto-speak-card">
          <div className="min-w-0" title={t("voice.autoSpeakHelp")}>
            <SettingsRow
              layout="inline"
              label={t("voice.autoSpeakLabel")}
              help={t("voice.autoSpeakHelp")}
            >
              <ToggleSwitch
                checked={settings.ttsEnabled}
                onChange={(next) => update({ ttsEnabled: next })}
                label={t("voice.autoSpeakLabel")}
                showLabel={false}
                data-testid="voice-tts-enabled"
              />
            </SettingsRow>
          </div>
        </VoicePrefCard>

        <VoicePrefCard title={t("voice.sessionSectionTitle")} testId="voice-session-card">
          <FormStack gap="md">
            <FormGrid>
              <SettingsRow layout="inline" label={t("voice.languageLabel")} htmlFor="voice-speech-language">
                <VoiceSelectWrap>
                  <MenuSelect
                    id="voice-speech-language"
                    variant="field"
                    menuPortal
                    value={settings.speechLanguage}
                    options={languageOptions.map((opt) => ({
                      value: opt.id,
                      label: opt.label,
                    }))}
                    onChange={(next) => update({ speechLanguage: next })}
                    aria-label={t("voice.languageLabel")}
                  />
                </VoiceSelectWrap>
              </SettingsRow>

              <SettingsRow
                layout="inline"
                label={t("voice.spacePttLabel")}
                htmlFor="voice-space-ptt-mode"
                help={
                  voicePttSupported ? t("voice.spacePttHelp") : t("voice.spacePttHelpDesktopBlocked")
                }
              >
                <VoiceSelectWrap>
                  <MenuSelect
                    id="voice-space-ptt-mode"
                    variant="field"
                    menuPortal
                    value={settings.spacePttMode}
                    options={[
                      { value: "hold", label: t("voice.spacePttOptions.hold") },
                      { value: "toggle", label: t("voice.spacePttOptions.toggle") },
                    ]}
                    onChange={(next) => update({ spacePttMode: next as SpacePttMode })}
                    data-testid="voice-space-ptt-mode"
                    aria-label={t("voice.spacePttLabel")}
                  />
                </VoiceSelectWrap>
              </SettingsRow>
            </FormGrid>

            <SettingsRow
              layout="inline"
              label={t("voice.defaultWorksetLabel")}
              htmlFor="voice-default-calendar-workset"
              help={t("voice.defaultWorksetHelp")}
            >
              <VoiceSelectWrap>
                <WorksetTargetSelect
                  id="voice-default-calendar-workset"
                  value={settings.defaultWorksetId}
                  onChange={(worksetId) => {
                    persistAssistantDefaultWorksetId(worksetId);
                    setSettings((prev) => ({
                      ...prev,
                      defaultWorksetId: loadVoiceSettings().defaultWorksetId,
                    }));
                  }}
                  data-testid="voice-default-calendar-workset"
                />
              </VoiceSelectWrap>
            </SettingsRow>
          </FormStack>
        </VoicePrefCard>
      </SettingsFieldGroup>
    </SettingsContentCard>
  );
}
