import { useTranslation } from "react-i18next";
import { PasswordField, SettingsRow } from "../../../components/ui";
import { SourceAddFormCard } from "../board/SourceAddFormCard";

interface DiscordBotFormProps {
  botToken: string;
  setBotToken: (v: string) => void;
  submitting: boolean;
  formError: string | null;
  onSubmit: () => void;
}

export function DiscordBotForm({
  botToken,
  setBotToken,
  submitting,
  formError,
  onSubmit,
}: DiscordBotFormProps) {
  const { t } = useTranslation("sources");
  return (
    <SourceAddFormCard
      formError={formError}
      submitting={submitting}
      submittingLabel={t("discordFields.adding")}
      submitLabel={t("discordFields.addBot")}
      submitDisabled={!botToken.trim()}
      onSubmit={onSubmit}
    >
      <SettingsRow label={t("discordFields.botToken")} htmlFor="discord-bot-token">
        <PasswordField
          id="discord-bot-token"
          placeholder={t("discordFields.tokenPlaceholder")}
          value={botToken}
          onChange={(e) => setBotToken(e.target.value)}
          disabled={submitting}
        />
      </SettingsRow>
    </SourceAddFormCard>
  );
}
