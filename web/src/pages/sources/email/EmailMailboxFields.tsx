import { CheckboxField, SelectField, SettingsRow, TextArea, TextField } from "../../../components/ui";
import type { Dispatch, SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import type { EmailFormFields, EmailProviderPreset } from "./emailFormModel";
import { EMAIL_PROVIDER_PRESETS } from "./emailFormModel";

interface EmailMailboxFieldsProps {
  form: EmailFormFields;
  setForm: Dispatch<SetStateAction<EmailFormFields>>;
  setPreset: (preset: EmailProviderPreset) => void;
  submitting: boolean;
}

export function EmailMailboxFields({
  form,
  setForm,
  setPreset,
  submitting,
}: EmailMailboxFieldsProps) {
  const { t } = useTranslation("sources");
  return (
    <div className="flex flex-col gap-xl">
      <SettingsRow label={t("emailFields.provider")} htmlFor="email-preset">
        <SelectField
          id="email-preset"
          value={form.preset}
          onChange={(e) => setPreset(e.target.value as EmailProviderPreset)}
          disabled={submitting}
        >
          {Object.keys(EMAIL_PROVIDER_PRESETS).map((key) => (
            <option key={key} value={key}>
              {key === "gmail"
                ? "Gmail"
                : key === "outlook"
                  ? "Outlook / Office 365"
                  : key === "yahoo"
                    ? "Yahoo"
                    : t("emailFields.customHost")}
            </option>
          ))}
        </SelectField>
      </SettingsRow>

      <SettingsRow label={t("emailFields.imapHost")} htmlFor="email-imap-host">
        <TextField
          id="email-imap-host"
          value={form.imapHost}
          onChange={(e) => setForm((s) => ({ ...s, imapHost: e.target.value, preset: "custom" }))}
          disabled={submitting}
          placeholder="imap.gmail.com"
        />
      </SettingsRow>

      <div className="grid grid-cols-1 gap-xl">
        <SettingsRow label={t("emailFields.port")} htmlFor="email-imap-port">
          <TextField
            id="email-imap-port"
            type="number"
            min={1}
            max={65535}
            value={form.imapPort}
            onChange={(e) =>
              setForm((s) => ({ ...s, imapPort: Number(e.target.value) || 993 }))
            }
            disabled={submitting}
          />
        </SettingsRow>

        <SettingsRow label="SSL">
          <CheckboxField
            label={form.useSsl ? t("emailFields.sslOn") : t("emailFields.sslOff")}
            checked={form.useSsl}
            onChange={(e) => setForm((s) => ({ ...s, useSsl: e.target.checked }))}
            disabled={submitting}
            aria-label={t("emailFields.sslAria")}
          />
        </SettingsRow>
      </div>

      <SettingsRow label={t("emailFields.emailAddress")} htmlFor="email-username">
        <TextField
          id="email-username"
          type="email"
          value={form.username}
          onChange={(e) => setForm((s) => ({ ...s, username: e.target.value }))}
          disabled={submitting}
          placeholder="user@gmail.com"
        />
      </SettingsRow>

      <SettingsRow label="App Password *" htmlFor="email-password">
        <TextField
          id="email-password"
          type="password"
          value={form.password}
          onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))}
          disabled={submitting}
          autoComplete="new-password"
        />
      </SettingsRow>

      <SettingsRow label={t("emailFields.folders")} htmlFor="email-folders">
        <TextArea
          id="email-folders"
          className="min-h-[72px]"
          value={form.foldersText}
          onChange={(e) => setForm((s) => ({ ...s, foldersText: e.target.value }))}
          disabled={submitting}
          placeholder="INBOX"
        />
      </SettingsRow>

      <div className="grid grid-cols-1 gap-xl">
        <SettingsRow label={t("emailFields.pollInterval")} htmlFor="email-poll-interval">
          <TextField
            id="email-poll-interval"
            type="number"
            min={1}
            max={1440}
            value={form.pollIntervalMinutes}
            onChange={(e) =>
              setForm((s) => ({
                ...s,
                pollIntervalMinutes: Number(e.target.value) || 5,
              }))
            }
            disabled={submitting}
          />
        </SettingsRow>

        <SettingsRow label={t("emailFields.initialSyncDays")} htmlFor="email-initial-sync-days">
          <TextField
            id="email-initial-sync-days"
            type="number"
            min={1}
            value={form.initialSyncDays}
            onChange={(e) =>
              setForm((s) => ({ ...s, initialSyncDays: Number(e.target.value) || 7 }))
            }
            disabled={submitting}
          />
        </SettingsRow>

        <SettingsRow label={t("emailFields.initialSyncMax")} htmlFor="email-initial-sync-max">
          <TextField
            id="email-initial-sync-max"
            type="number"
            min={1}
            value={form.initialSyncMaxMessages}
            onChange={(e) =>
              setForm((s) => ({
                ...s,
                initialSyncMaxMessages: Number(e.target.value) || 100,
              }))
            }
            disabled={submitting}
          />
        </SettingsRow>
      </div>

      <SettingsRow
        label={t("emailFields.allowlist")}
        htmlFor="email-sender-allowlist"
        help={t("emailFields.allowlistHelp")}
      >
        <TextField
          id="email-sender-allowlist"
          value={form.senderAllowlistText}
          onChange={(e) => setForm((s) => ({ ...s, senderAllowlistText: e.target.value }))}
          disabled={submitting}
          placeholder="alerts@example.com, newsletter@"
        />
      </SettingsRow>

      <SettingsRow label={t("emailFields.markAsRead")}>
        <CheckboxField
          label={form.markAsRead ? t("emailFields.enabled") : t("emailFields.disabled")}
          checked={form.markAsRead}
          onChange={(e) => setForm((s) => ({ ...s, markAsRead: e.target.checked }))}
          disabled={submitting}
          aria-label={t("emailFields.markAsRead")}
        />
      </SettingsRow>
    </div>
  );
}
