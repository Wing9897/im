import { useTranslation } from "react-i18next";
import { Button, SettingsRow, TextField } from "../../../../../components/ui";
import { SourceAddFormCard } from "../../../SourceAddFormCard";
import type { RssAddFormProps } from "../types";

const V2EX_PRESET_IDS = [
  {
    id: "all",
    labelKey: "rssFields.v2exAll",
    feedUrl: "https://www.v2ex.com/feed/tab/all.xml",
  },
  {
    id: "tech",
    labelKey: "rssFields.v2exTech",
    feedUrl: "https://www.v2ex.com/feed/tab/tech.xml",
  },
  {
    id: "creative",
    labelKey: "rssFields.v2exCreative",
    feedUrl: "https://www.v2ex.com/feed/tab/creative.xml",
  },
  {
    id: "play",
    labelKey: "rssFields.v2exPlay",
    feedUrl: "https://www.v2ex.com/feed/tab/play.xml",
  },
] as const;

export function V2exFeedForm({
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
        <SettingsRow label={t("rssFields.v2exPresets")} help={t("rssFields.v2exPresetsHelp")}>
          <div className="flex flex-wrap gap-sm">
            {V2EX_PRESET_IDS.map((preset) => {
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
                      name: prev.name.trim() ? prev.name : `V2EX · ${label}`,
                    }));
                  }}
                >
                  {label}
                </Button>
              );
            })}
          </div>
        </SettingsRow>

        <SettingsRow label={t("rssFields.feedUrl")} htmlFor="v2ex-feed-url">
          <TextField
            id="v2ex-feed-url"
            type="url"
            placeholder="https://www.v2ex.com/feed/tab/all.xml"
            value={fields.feedUrl}
            onChange={(e) => setFields((s) => ({ ...s, feedUrl: e.target.value }))}
            disabled={submitting}
          />
        </SettingsRow>

        <SettingsRow label={t("rssFields.displayName")} htmlFor="v2ex-feed-name">
          <TextField
            id="v2ex-feed-name"
            type="text"
            value={fields.name}
            onChange={(e) => setFields((s) => ({ ...s, name: e.target.value }))}
            disabled={submitting}
          />
        </SettingsRow>

        <SettingsRow label={t("rssFields.pollInterval")} htmlFor="v2ex-poll-interval">
          <TextField
            id="v2ex-poll-interval"
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
