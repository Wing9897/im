import { useTranslation } from "react-i18next";
import { FormField, SettingsRow, TextField } from "../../../components/ui";
import type { ActionFormState, HeaderEntry } from "../form/useActionFormDialog";
import { DiscordFields } from "../field-sections/DiscordFieldSection";
import { HttpFields } from "../field-sections/HttpFieldSection";
import { MqttFields } from "../field-sections/MqttFieldSection";
import type { ComponentType } from "react";

function TelegramFields({
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
    <div className="grid grid-cols-1 gap-lg sm:grid-cols-2">
      <SettingsRow label={t("fields.botToken")} htmlFor="action-bot-token">
        <FormField error={fieldErrors.bot_token}>
          <TextField
            id="action-bot-token"
            type="text"
            placeholder="123456:ABC-DEF..."
            value={form.botToken}
            onChange={(e) => onChange("botToken", e.target.value)}
            disabled={submitting}
          />
        </FormField>
      </SettingsRow>
      <SettingsRow label={t("fields.chatId")} htmlFor="action-chat-id">
        <FormField error={fieldErrors.chat_id}>
          <TextField
            id="action-chat-id"
            type="text"
            placeholder="-1001234567890"
            value={form.chatId}
            onChange={(e) => onChange("chatId", e.target.value)}
            disabled={submitting}
          />
        </FormField>
      </SettingsRow>
    </div>
  );
}

const actionTypeComponents: Record<string, ComponentType<{
  form: ActionFormState;
  fieldErrors: Record<string, string>;
  submitting: boolean;
  onChange: (field: keyof ActionFormState, value: string | boolean | number | HeaderEntry[]) => void;
}>> = {
  telegram_bot: TelegramFields,
  discord_webhook: DiscordFields,
  http_webhook: HttpFields,
  mqtt: MqttFields,
};

export function ActionTypeFields({
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
  if (!form.actionType) return null;
  const Component = actionTypeComponents[form.actionType];
  if (!Component) return null;
  return <Component form={form} fieldErrors={fieldErrors} submitting={submitting} onChange={onChange} />;
}

