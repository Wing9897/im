import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  FormGrid,
  FormStack,
  MenuSelect,
  SelectField,
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
              {/* Native select: MenuSelect has no disabled-option support for unavailable providers. */}
              <SelectField
                id="voice-stt-provider"
                wrapperClassName="w-[16rem] max-w-full shrink-0"
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
          </VoicePrefCard>

          <VoicePrefCard title={t("voice.ttsSectionTitle")} testId="voice-tts-card">
            <FormStack gap="md">
              <SettingsRow
                layout="inline"
                label={t("voice.ttsLabel")}
                htmlFor="voice-tts-provider"
                help={t("voice.ttsHelp")}
              >
                {/* Native select: MenuSelect has no disabled-option support for unavailable providers. */}
                <SelectField
                  id="voice-tts-provider"
                  wrapperClassName="w-[16rem] max-w-full shrink-0"
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

              {settings.ttsProvider === "browser" ? (
                <SettingsRow
                  layout="inline"
                  label={t("voice.ttsVoiceLabel")}
                  htmlFor="voice-tts-voice"
                  help={t("voice.ttsVoiceHelp")}
                >
                  <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
                    <div className="w-[16rem] max-w-full shrink-0">
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
                        aria-label={t("voice.ttsVoiceLabel")}
                      />
                    </div>
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
                <div className="w-[16rem] max-w-full shrink-0">
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
                </div>
              </SettingsRow>

              <SettingsRow
                layout="inline"
                label={t("voice.spacePttLabel")}
                htmlFor="voice-space-ptt-mode"
                help={
                  voicePttSupported ? t("voice.spacePttHelp") : t("voice.spacePttHelpDesktopBlocked")
                }
              >
                <div className="w-[16rem] max-w-full shrink-0">
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
                </div>
              </SettingsRow>
            </FormGrid>

            <SettingsRow
              layout="inline"
              label={t("voice.defaultWorksetLabel")}
              htmlFor="voice-default-calendar-workset"
              help={t("voice.defaultWorksetHelp")}
            >
              <div className="w-[16rem] max-w-full shrink-0">
                <WorksetTargetSelect
                  id="voice-default-calendar-workset"
                  value={settings.defaultWorksetId}
                  onChange={(taskId) => update({ defaultWorksetId: taskId })}
                  data-testid="voice-default-calendar-workset"
                />
              </div>
            </SettingsRow>
          </FormStack>
        </VoicePrefCard>
      </SettingsFieldGroup>
    </SettingsContentCard>
  );
}
