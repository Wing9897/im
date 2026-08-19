import { useTranslation } from "react-i18next";
import { FormField, SettingsRow, TextField } from "../../../components/ui";
import type { ActionFormState, HeaderEntry } from "../form/useActionFormDialog";

export function DiscordFields({
  form,
  fieldErrors,
  submitting,
  onChange,
}: {
  form: ActionFormState;
  fieldErrors: Record<string, string>;
  submitting: boolean;
  onChange: (field: keyof ActionFormState, value: string | boolean | number | HeaderEntry[]) => void;
}) {
  const { t } = useTranslation("actions");

  return (
    <SettingsRow label={t("fields.webhookUrl")} htmlFor="action-discord-webhook">
      <FormField error={fieldErrors.webhook_url}>
        <TextField
          id="action-discord-webhook"
          type="text"
          placeholder="https://discord.com/api/webhooks/..."
          value={form.discordWebhookUrl}
          onChange={(e) => onChange("discordWebhookUrl", e.target.value)}
          disabled={submitting}
        />
      </FormField>
    </SettingsRow>
  );
}
