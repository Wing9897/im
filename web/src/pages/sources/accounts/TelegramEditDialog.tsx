import { useTranslation } from "react-i18next";
import { SourceEditDialogShell } from "../SourceEditDialogShell";
import { SettingsRow, TextField } from "../../../components/ui";
import { formatAccountLabel } from "../../../utils/accountDisplay";
import type { Account } from "../../../types";

interface TelegramEditDialogProps {
  account: Account;
  name: string;
  setName: (value: string) => void;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onSave: () => void;
}

export function TelegramEditDialog({
  account,
  name,
  setName,
  submitting,
  error,
  onClose,
  onSave,
}: TelegramEditDialogProps) {
  const { t } = useTranslation("sources");
  return (
    <SourceEditDialogShell
      title={t("telegram.editTitle", { name: formatAccountLabel(account) })}
      submitting={submitting}
      error={error}
      onClose={onClose}
      onSave={onSave}
      saveLabel={t("shared.save")}
    >
      <SettingsRow label={t("telegram.displayName")} htmlFor="telegram-edit-name">
        <TextField
          id="telegram-edit-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={submitting}
          placeholder={t("telegram.displayNamePlaceholder")}
        />
      </SettingsRow>
      <p className="mt-sm text-xs text-text-muted">{t("telegram.editHint")}</p>
    </SourceEditDialogShell>
  );
}
