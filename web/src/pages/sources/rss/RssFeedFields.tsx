import { useTranslation } from "react-i18next";
import { SettingsRow, TextField } from "../../../components/ui";
import type { RssFormFields } from "./providers/types";

interface RssFeedFieldsProps {
  form: RssFormFields;
  setForm: (
    updater: RssFormFields | ((prev: RssFormFields) => RssFormFields),
  ) => void;
  submitting: boolean;
  /** Prefix for input ids when add + edit may mount together. */
  idPrefix?: string;
  pollClassName?: string;
}

/** Shared feed URL / display name / poll interval fields (add + edit). */
export function RssFeedFields({
  form,
  setForm,
  submitting,
  idPrefix = "rss",
  pollClassName,
}: RssFeedFieldsProps) {
  const { t } = useTranslation("sources");
  return (
    <div className="flex flex-col gap-xl">
      <SettingsRow label={t("rssFields.feedUrl")} htmlFor={`${idPrefix}-feed-url`}>
        <TextField
          id={`${idPrefix}-feed-url`}
          type="url"
          placeholder="https://example.com/feed.xml"
          value={form.feedUrl}
          onChange={(e) => setForm((s) => ({ ...s, feedUrl: e.target.value }))}
          disabled={submitting}
        />
      </SettingsRow>
      <SettingsRow label={t("rssFields.displayName")} htmlFor={`${idPrefix}-feed-name`}>
        <TextField
          id={`${idPrefix}-feed-name`}
          type="text"
          placeholder={t("rssFields.displayNamePlaceholder")}
          value={form.name}
          onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
          disabled={submitting}
        />
      </SettingsRow>
      <SettingsRow
        label={t("rssFields.pollInterval")}
        htmlFor={`${idPrefix}-poll-interval`}
        help={t("rssFields.pollIntervalHelp")}
      >
        <TextField
          id={`${idPrefix}-poll-interval`}
          type="number"
          min={1}
          max={1440}
          className={pollClassName}
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
