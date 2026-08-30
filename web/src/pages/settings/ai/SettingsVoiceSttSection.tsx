import { useTranslation } from "react-i18next";
import { SettingsRow } from "../../../components/ui";
import {
  getSttProviderOptions,
  type SttProviderId,
} from "../../../speech";
import { VoicePrefCard, VoiceProviderMenuSelect } from "./SettingsVoiceShared";

type Props = {
  sttProvider: SttProviderId;
  voicePttSupported: boolean;
  onSttProviderChange: (next: SttProviderId) => void;
};

export function SettingsVoiceSttSection({
  sttProvider,
  voicePttSupported,
  onSttProviderChange,
}: Props) {
  const { t } = useTranslation("settings");
  const sttOptions = getSttProviderOptions(t);
  const sttSelectValue = sttOptions.some((o) => o.id === sttProvider)
    ? sttProvider
    : "browser";

  return (
    <VoicePrefCard title={t("voice.sttSectionTitle")} testId="voice-stt-card">
      <SettingsRow
        layout="inline"
        label={t("voice.sttLabel")}
        htmlFor="voice-stt-provider"
        help={voicePttSupported ? t("voice.sttHelp") : t("voice.sttHelpDesktopBlocked")}
      >
        <VoiceProviderMenuSelect
          id="voice-stt-provider"
          value={sttSelectValue}
          options={sttOptions}
          onChange={(next) => onSttProviderChange(next as SttProviderId)}
          testId="voice-stt-provider"
          ariaLabel={t("voice.sttLabel")}
        />
      </SettingsRow>
    </VoicePrefCard>
  );
}
