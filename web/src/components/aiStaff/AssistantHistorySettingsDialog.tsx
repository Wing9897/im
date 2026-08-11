import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ModalDialog } from "../ModalDialog";
import { Button, FormGrid, FormStack, SettingsRow, TextField } from "../ui";
import type { SystemSettingsSnapshot } from "../../types";

type AssistantHistorySettingsDialogProps = {
  open: boolean;
  settings: SystemSettingsSnapshot;
  saving: boolean;
  onClose: () => void;
  onSave: (patch: Partial<SystemSettingsSnapshot>) => void | Promise<void>;
};

/** History caps only — LLM connection lives on profiles (Stamp 29). */
export function AssistantHistorySettingsDialog({
  open,
  settings,
  saving,
  onClose,
  onSave,
}: AssistantHistorySettingsDialogProps) {
  const { t } = useTranslation("settings");
  const [historyMaxMessages, setHistoryMaxMessages] = useState(
    settings.agentHistoryMaxMessages,
  );
  const [historyMaxChars, setHistoryMaxChars] = useState(settings.agentHistoryMaxChars);

  useEffect(() => {
    if (open) {
      setHistoryMaxMessages(settings.agentHistoryMaxMessages.trim() || "40");
      setHistoryMaxChars(settings.agentHistoryMaxChars.trim() || "48000");
    }
  }, [open, settings]);

  const handleSave = () => {
    void onSave({
      agentHistoryMaxMessages: historyMaxMessages.trim() || "40",
      agentHistoryMaxChars: historyMaxChars.trim() || "48000",
    });
  };

  return (
    <ModalDialog
      open={open}
      title={t("staff.historyDialogTitle")}
      onClose={onClose}
      size="form"
      testId="assistant-history-dialog"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            {t("staff.llmDialogCancel")}
          </Button>
          <Button type="button" variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? t("shared.saving") : t("staff.llmDialogSave")}
          </Button>
        </>
      }
    >
      <FormStack gap="lg">
        <FormGrid>
          <SettingsRow
            label={t("staff.historyMaxMessagesLabel")}
            htmlFor="assistant-history-max-messages"
            help={t("staff.historyMaxMessagesHelp")}
          >
            <TextField
              id="assistant-history-max-messages"
              data-testid="assistant-history-max-messages"
              inputMode="numeric"
              value={historyMaxMessages}
              onChange={(e) => setHistoryMaxMessages(e.target.value)}
            />
          </SettingsRow>
          <SettingsRow
            label={t("staff.historyMaxCharsLabel")}
            htmlFor="assistant-history-max-chars"
            help={t("staff.historyMaxCharsHelp")}
          >
            <TextField
              id="assistant-history-max-chars"
              data-testid="assistant-history-max-chars"
              inputMode="numeric"
              value={historyMaxChars}
              onChange={(e) => setHistoryMaxChars(e.target.value)}
            />
          </SettingsRow>
        </FormGrid>
      </FormStack>
    </ModalDialog>
  );
}
