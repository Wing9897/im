import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { FormGrid, FormStack, MenuSelect, SettingsRow } from "../../components/ui";
import {
  getSpeechLanguageOptions,
  type SpacePttMode,
} from "../../speech";
import { VoicePrefCard, VoiceSelectWrap } from "./SettingsVoiceShared";

type Props = {
  speechLanguage: string;
  spacePttMode: SpacePttMode;
  voicePttSupported: boolean;
  onSpeechLanguageChange: (next: string) => void;
  onSpacePttModeChange: (next: SpacePttMode) => void;
  children: ReactNode;
};

export function SettingsVoicePttSection({
  speechLanguage,
  spacePttMode,
  voicePttSupported,
  onSpeechLanguageChange,
  onSpacePttModeChange,
  children,
}: Props) {
  const { t } = useTranslation("settings");
  const languageOptions = getSpeechLanguageOptions(t);

  return (
    <VoicePrefCard title={t("voice.sessionSectionTitle")} testId="voice-session-card">
      <FormStack gap="md">
        <FormGrid>
          <SettingsRow layout="inline" label={t("voice.languageLabel")} htmlFor="voice-speech-language">
            <VoiceSelectWrap>
              <MenuSelect
                id="voice-speech-language"
                variant="field"
                menuPortal
                value={speechLanguage}
                options={languageOptions.map((opt) => ({
                  value: opt.id,
                  label: opt.label,
                }))}
                onChange={onSpeechLanguageChange}
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
                value={spacePttMode}
                options={[
                  { value: "hold", label: t("voice.spacePttOptions.hold") },
                  { value: "toggle", label: t("voice.spacePttOptions.toggle") },
                ]}
                onChange={(next) => onSpacePttModeChange(next as SpacePttMode)}
                data-testid="voice-space-ptt-mode"
                aria-label={t("voice.spacePttLabel")}
              />
            </VoiceSelectWrap>
          </SettingsRow>
        </FormGrid>

        {children}
      </FormStack>
    </VoicePrefCard>
  );
}
