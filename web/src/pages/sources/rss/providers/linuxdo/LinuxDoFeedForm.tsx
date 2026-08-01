import { useTranslation } from "react-i18next";
import { Button, SettingsRow, TextField } from "../../../../../components/ui";
import { SourceAddFormCard } from "../../../SourceAddFormCard";
import type { RssAddFormProps } from "../types";

const LINUX_DO_PRESET_IDS = [
  { id: "latest", labelKey: "rssFields.linuxdoLatest", feedUrl: "https://linux.do/latest.rss" },
  { id: "top", labelKey: "rssFields.linuxdoTop", feedUrl: "https://linux.do/top.rss" },
  { id: "posts", labelKey: "rssFields.linuxdoPosts", feedUrl: "https://linux.do/posts.rss" },
] as const;

export function LinuxDoFeedForm({
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
        <SettingsRow
          label={t("rssFields.linuxdoPresets")}
          help={t("rssFields.linuxdoPresetsHelp")}
        >
          <div className="flex flex-wrap gap-sm">
            {LINUX_DO_PRESET_IDS.map((preset) => {
              const label = t(preset.labelKey);
              return (
                <Button
                  key={preset.id}
                  size="sm"
                  variant="secondary"
                  disabled={submitting}
                  onClick={() => {
                    setFields((prev) => ({
                      ...prev,
                      feedUrl: preset.feedUrl,
                      name: prev.name.trim() ? prev.name : `LINUX.DO · ${label}`,
                    }));
                  }}
                >
                  {label}
                </Button>
              );
            })}
          </div>
        </SettingsRow>

        <SettingsRow label={t("rssFields.feedUrl")} htmlFor="linuxdo-feed-url">
          <TextField
            id="linuxdo-feed-url"
            type="url"
            placeholder="https://linux.do/latest.rss"
            value={fields.feedUrl}
            onChange={(e) => setFields((s) => ({ ...s, feedUrl: e.target.value }))}
            disabled={submitting}
          />
        </SettingsRow>

        <SettingsRow label={t("rssFields.displayName")} htmlFor="linuxdo-feed-name">
          <TextField
            id="linuxdo-feed-name"
            type="text"
            value={fields.name}
            onChange={(e) => setFields((s) => ({ ...s, name: e.target.value }))}
            disabled={submitting}
          />
        </SettingsRow>

        <SettingsRow label={t("rssFields.pollInterval")} htmlFor="linuxdo-poll-interval">
          <TextField
            id="linuxdo-poll-interval"
            type="number"
            min={1}
            max={1440}
            value={fields.pollIntervalMinutes}
            onChange={(e) =>
              setFields((s) => ({
                ...s,
                pollIntervalMinutes: Math.max(1, Number(e.target.value) || 10),
              }))
            }
            disabled={submitting}
          />
        </SettingsRow>
      </div>
    </SourceAddFormCard>
  );
}
