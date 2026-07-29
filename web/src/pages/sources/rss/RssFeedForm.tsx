import { useTranslation } from "react-i18next";
import { SettingsRow, TextField } from "../../../components/ui";
import { SourceAddFormCard } from "../SourceAddFormCard";
import type { RssAddFormProps } from "./providers/types";

export function RssFeedForm({
  fields,
  setFields,
  submitting,
  formError,
  onSubmit,
}: RssAddFormProps) {
  const { t } = useTranslation("sources");
  return (
    <SourceAddFormCard
      formError={formError}
      submitting={submitting}
      submittingLabel={t("rssFields.adding")}
      submitLabel={t("rssFields.addFeed")}
      submitDisabled={!fields.feedUrl.trim()}
      onSubmit={onSubmit}
    >
      <div className="flex flex-col gap-xl">
        <SettingsRow label={t("rssFields.feedUrl")} htmlFor="rss-feed-url">
          <TextField
            id="rss-feed-url"
            type="url"
            placeholder="https://example.com/feed.xml"
            value={fields.feedUrl}
            onChange={(e) => setFields((s) => ({ ...s, feedUrl: e.target.value }))}
            disabled={submitting}
          />
        </SettingsRow>

        <SettingsRow label={t("rssFields.displayName")} htmlFor="rss-feed-name">
          <TextField
            id="rss-feed-name"
            type="text"
            placeholder={t("rssFields.displayNamePlaceholder")}
            value={fields.name}
            onChange={(e) => setFields((s) => ({ ...s, name: e.target.value }))}
            disabled={submitting}
          />
        </SettingsRow>

        <SettingsRow
          label={t("rssFields.pollInterval")}
          htmlFor="rss-poll-interval"
          help={t("rssFields.pollIntervalHelp")}
        >
          <TextField
            id="rss-poll-interval"
            type="number"
            min={1}
            max={1440}
            className="max-w-[200px]"
            value={fields.pollIntervalMinutes}
            onChange={(e) =>
              setFields((s) => ({
                ...s,
                pollIntervalMinutes: Math.max(1, Number(e.target.value) || 5),
              }))
            }
            disabled={submitting}
          />
        </SettingsRow>
      </div>
    </SourceAddFormCard>
  );
}
