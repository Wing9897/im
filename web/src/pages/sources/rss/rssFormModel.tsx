import { useTranslation } from "react-i18next";
import { SourceEditDialogShell } from "../SourceEditDialogShell";
import type { RssFeedInfo } from "../../../types";
import type { RssFormFields } from "./providers/types";
import { RssFeedFields } from "./RssFeedFields";

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
      <RssFeedFields form={form} setForm={setForm} submitting={submitting} idPrefix="rss-edit" />
    </SourceEditDialogShell>
  );
}
