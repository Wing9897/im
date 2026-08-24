import { useTranslation } from "react-i18next";
import { WorksetTargetSelect } from "../../components/assistant/WorksetTargetSelect";
import { SettingsRow } from "../../components/ui";
import { loadVoiceSettings, persistAssistantDefaultWorksetId } from "../../speech";
import { VoiceSelectWrap } from "./SettingsVoiceShared";

type Props = {
  defaultWorksetId: string;
  onDefaultWorksetIdChange: (worksetId: string) => void;
};

export function SettingsVoiceWorksetSection({
  defaultWorksetId,
  onDefaultWorksetIdChange,
}: Props) {
  const { t } = useTranslation("settings");

  return (
    <SettingsRow
      layout="inline"
      label={t("voice.defaultWorksetLabel")}
      htmlFor="voice-default-calendar-workset"
      help={t("voice.defaultWorksetHelp")}
    >
      <VoiceSelectWrap>
        <WorksetTargetSelect
          id="voice-default-calendar-workset"
          value={defaultWorksetId}
          onChange={(worksetId) => {
            persistAssistantDefaultWorksetId(worksetId);
            onDefaultWorksetIdChange(loadVoiceSettings().defaultWorksetId);
          }}
          data-testid="voice-default-calendar-workset"
        />
      </VoiceSelectWrap>
    </SettingsRow>
  );
}
