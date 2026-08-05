import { useTranslation } from "react-i18next";
import { SourceEditDialogShell } from "../SourceEditDialogShell";
import { PasswordField, SettingsRow, TextField } from "../../../components/ui";
import { formatSourceLabel } from "../../../utils/sourceDisplay";
import { MASKED_SECRET } from "../../../utils/configValidation";
import type { DiscordBotInfo } from "../../../types";

interface DiscordEditDialogProps {
  bot: DiscordBotInfo;
  name: string;
  setName: (value: string) => void;
  botToken: string;
  setBotToken: (value: string) => void;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onSave: () => void;
}

export function DiscordEditDialog({
  bot,
  name,
  setName,
  botToken,
  setBotToken,
  submitting,
  error,
  onClose,
  onSave,
}: DiscordEditDialogProps) {
  const { t } = useTranslation("sources");
  const fallback = t("discord.fallbackName");
  return (
    <SourceEditDialogShell
      title={t("discord.editTitle", {
        name: formatSourceLabel(bot.source) || fallback,
      })}
      submitting={submitting}
      error={error}
      onClose={onClose}
      onSave={onSave}
      saveLabel={
        botToken && botToken !== MASKED_SECRET
          ? t("shared.saveAndReconnect")
          : t("shared.save")
      }
    >
      <SettingsRow label={t("discord.displayName")} htmlFor="discord-edit-name">
        <TextField
          id="discord-edit-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={submitting}
          placeholder={fallback}
        />
      </SettingsRow>
      <div className="mt-md">
        <SettingsRow label={t("discordFields.botTokenOptional")} htmlFor="discord-edit-token">
          <PasswordField
            id="discord-edit-token"
            value={botToken}
            onChange={(e) => setBotToken(e.target.value)}
            disabled={submitting}
            placeholder={t("discord.tokenKeepPlaceholder")}
          />
        </SettingsRow>
      </div>
      <p className="mt-sm text-xs text-text-muted">{t("discord.editHint")}</p>
    </SourceEditDialogShell>
  );
}
