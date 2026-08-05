import { useTranslation } from "react-i18next";
import { SourceEditDialogShell } from "../SourceEditDialogShell";
import { SettingsRow, TextField } from "../../../components/ui";
import { formatSourceLabel } from "../../../utils/sourceDisplay";
import type { Source } from "../../../types";

interface TelegramSourceEditDialogProps {
  source: Source;
  name: string;
  setName: (value: string) => void;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onSave: () => void;
}

export function TelegramSourceEditDialog({
  source,
  name,
  setName,
  submitting,
  error,
  onClose,
  onSave,
}: TelegramSourceEditDialogProps) {
  const { t } = useTranslation("sources");
  return (
    <SourceEditDialogShell
      title={t("telegram.editTitle", { name: formatSourceLabel(source) })}
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
