import { useTranslation } from "react-i18next";
import { SettingsRow, TextField } from "../../../components/ui";
import { SourceEditDialogShell } from "../SourceEditDialogShell";
import type { RssFeedInfo } from "../../../types";
import type { RssFormFields } from "./providers/types";

export function feedToForm(feed: RssFeedInfo): RssFormFields {
  return {
    feedUrl: feed.feedUrl,
    name: feed.account.name || "",
    pollIntervalMinutes: Math.max(1, Math.round(feed.pollIntervalSeconds / 60)),
  };
}

export function formToCreatePayload(form: RssFormFields) {
  return {
    feedUrl: form.feedUrl.trim(),
    name: form.name.trim() || null,
    pollIntervalSeconds: Math.max(60, form.pollIntervalMinutes * 60),
  };
}

export function formToPatch(form: RssFormFields) {
  return {
    feedUrl: form.feedUrl.trim(),
    name: form.name.trim() || null,
    pollIntervalSeconds: Math.max(60, form.pollIntervalMinutes * 60),
  };
}

interface RssFeedFieldsProps {
  form: RssFormFields;
  setForm: React.Dispatch<React.SetStateAction<RssFormFields>>;
  submitting: boolean;
}

function RssFeedFields({ form, setForm, submitting }: RssFeedFieldsProps) {
  const { t } = useTranslation("sources");
  return (
    <div className="flex flex-col gap-xl">
      <SettingsRow label={t("rssFields.feedUrl")} htmlFor="rss-edit-feed-url">
        <TextField
          id="rss-edit-feed-url"
          type="url"
          placeholder="https://example.com/feed.xml"
          value={form.feedUrl}
          onChange={(e) => setForm((s) => ({ ...s, feedUrl: e.target.value }))}
          disabled={submitting}
        />
      </SettingsRow>
      <SettingsRow label={t("rssFields.displayName")} htmlFor="rss-edit-feed-name">
        <TextField
          id="rss-edit-feed-name"
          type="text"
          placeholder={t("rssFields.displayNamePlaceholder")}
          value={form.name}
          onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
          disabled={submitting}
        />
      </SettingsRow>
      <SettingsRow
        label={t("rssFields.pollInterval")}
        htmlFor="rss-edit-poll-interval"
        help={t("rssFields.pollIntervalHelp")}
      >
        <TextField
          id="rss-edit-poll-interval"
          type="number"
          min={1}
          max={1440}
          value={form.pollIntervalMinutes}
          onChange={(e) =>
            setForm((s) => ({
              ...s,
              pollIntervalMinutes: Math.max(1, Number(e.target.value) || 5),
            }))
          }
          disabled={submitting}
        />
      </SettingsRow>
    </div>
  );
}

interface RssEditDialogProps {
  feed: RssFeedInfo;
  form: RssFormFields;
  setForm: React.Dispatch<React.SetStateAction<RssFormFields>>;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onSave: () => void;
}

export function RssEditDialog({
  feed,
  form,
  setForm,
  submitting,
  error,
  onClose,
  onSave,
}: RssEditDialogProps) {
  const { t } = useTranslation("sources");
  return (
    <SourceEditDialogShell
      title={t("rssFields.editTitle", { name: feed.feedUrl })}
      submitting={submitting}
      error={error}
      onClose={onClose}
      onSave={onSave}
    >
      <RssFeedFields form={form} setForm={setForm} submitting={submitting} />
    </SourceEditDialogShell>
  );
}
