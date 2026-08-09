import { useTranslation } from "react-i18next";
import { Button, SettingsRow, TextField } from "../../../../../components/ui";
import { SourceAddFormCard } from "../../../board/SourceAddFormCard";
import type { RssAddFormProps } from "../types";

const HN_PRESET_IDS = [
  { id: "front", labelKey: "rssFields.hnFront", feedUrl: "https://hnrss.org/frontpage" },
  { id: "newest", labelKey: "rssFields.hnNewest", feedUrl: "https://hnrss.org/newest" },
  { id: "best", labelKey: "rssFields.hnBest", feedUrl: "https://hnrss.org/best" },
  { id: "show", labelKey: "rssFields.hnShow", feedUrl: "https://hnrss.org/show" },
  { id: "ask", labelKey: "rssFields.hnAsk", feedUrl: "https://hnrss.org/ask" },
] as const;

export function HackerNewsFeedForm({
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
        <SettingsRow label={t("rssFields.hnPresets")} help={t("rssFields.hnPresetsHelp")}>
          <div className="flex flex-wrap gap-sm">
            {HN_PRESET_IDS.map((preset) => {
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
                      name: prev.name.trim() ? prev.name : `HN · ${label}`,
                    }));
                  }}
                >
                  {label}
                </Button>
              );
            })}
          </div>
        </SettingsRow>

        <SettingsRow label={t("rssFields.feedUrl")} htmlFor="hn-feed-url">
          <TextField
            id="hn-feed-url"
            type="url"
            placeholder="https://hnrss.org/frontpage"
            value={fields.feedUrl}
            onChange={(e) => setFields((s) => ({ ...s, feedUrl: e.target.value }))}
            disabled={submitting}
          />
        </SettingsRow>

        <SettingsRow label={t("rssFields.displayName")} htmlFor="hn-feed-name">
          <TextField
            id="hn-feed-name"
            type="text"
            value={fields.name}
            onChange={(e) => setFields((s) => ({ ...s, name: e.target.value }))}
            disabled={submitting}
          />
        </SettingsRow>

        <SettingsRow label={t("rssFields.pollInterval")} htmlFor="hn-poll-interval">
          <TextField
            id="hn-poll-interval"
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
