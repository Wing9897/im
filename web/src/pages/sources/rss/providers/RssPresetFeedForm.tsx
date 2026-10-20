import { useTranslation } from "react-i18next";
import { Button, SettingsRow, TextField } from "../../../../components/ui";
import { SourceAddFormCard } from "../../board/SourceAddFormCard";
import { githubAtomUrl } from "./rssUrlPatterns";
import type { RssAddFormProps } from "./types";

export interface RssPresetFeed {
  id: string;
  labelKey: string;
  feedUrl: string;
}

const ATOM_KIND_PRESETS = [
  { id: "releases", label: "Releases", kind: "releases" as const },
  { id: "tags", label: "Tags", kind: "tags" as const },
  { id: "commits", label: "Commits (master)", kind: "commits" as const },
];

interface RssPresetFeedFormProps extends RssAddFormProps {
  presets: readonly RssPresetFeed[];
  presetsLabelKey: string;
  presetsHelpKey?: string;
  namePrefix: string;
  idPrefix: string;
  urlPlaceholder: string;
  urlLabelKey?: string;
  urlHelpKey?: string;
  pollFallback?: number;
  /** GitHub repo slugs are already display text, not i18n keys. */
  translateLabels?: boolean;
  /** GitHub kind row rewrites the current owner/repo Atom URL. */
  atomKinds?: boolean;
}

export function RssPresetFeedForm({
  fields,
  setFields,
  submitting,
  formError,
  onSubmit,
  presets,
  presetsLabelKey,
  presetsHelpKey,
  namePrefix,
  idPrefix,
  urlPlaceholder,
  urlLabelKey = "rssFields.feedUrl",
  urlHelpKey,
  pollFallback = 10,
  translateLabels = true,
  atomKinds = false,
}: RssPresetFeedFormProps) {
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
          label={t(presetsLabelKey)}
          help={presetsHelpKey ? t(presetsHelpKey) : undefined}
        >
          <div className="flex flex-wrap gap-sm">
            {presets.map((preset) => {
              const label = translateLabels ? t(preset.labelKey) : preset.labelKey;
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
                      name: prev.name.trim() ? prev.name : `${namePrefix} · ${label}`,
                    }));
                  }}
                >
                  {label}
                </Button>
              );
            })}
          </div>
        </SettingsRow>

        {atomKinds ? (
          <SettingsRow label={t("rssFields.feedKind")}>
            <div className="flex flex-wrap gap-sm">
              {ATOM_KIND_PRESETS.map((preset) => (
                <Button
                  key={preset.id}
                  size="sm"
                  variant="secondary"
                  disabled={submitting}
                  onClick={() => {
                    const match = fields.feedUrl.match(/github\.com\/([^/]+\/[^/]+)/);
                    const repo = match?.[1] ?? "owner/repo";
                    setFields((prev) => ({
                      ...prev,
                      feedUrl: githubAtomUrl(repo, preset.kind),
                    }));
                  }}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </SettingsRow>
        ) : null}

        <SettingsRow label={t(urlLabelKey)} htmlFor={`${idPrefix}-feed-url`}>
          <TextField
            id={`${idPrefix}-feed-url`}
            type="url"
            placeholder={urlPlaceholder}
            value={fields.feedUrl}
            onChange={(e) => setFields((s) => ({ ...s, feedUrl: e.target.value }))}
            disabled={submitting}
          />
          {urlHelpKey ? (
            <p className="mt-1 text-xs text-text-muted">{t(urlHelpKey)}</p>
          ) : null}
        </SettingsRow>

        <SettingsRow label={t("rssFields.displayName")} htmlFor={`${idPrefix}-feed-name`}>
          <TextField
            id={`${idPrefix}-feed-name`}
            type="text"
            value={fields.name}
            onChange={(e) => setFields((s) => ({ ...s, name: e.target.value }))}
            disabled={submitting}
          />
        </SettingsRow>

        <SettingsRow label={t("rssFields.pollInterval")} htmlFor={`${idPrefix}-poll-interval`}>
          <TextField
            id={`${idPrefix}-poll-interval`}
            type="number"
            min={1}
            max={1440}
            value={fields.pollIntervalMinutes}
            onChange={(e) =>
              setFields((s) => ({
                ...s,
                pollIntervalMinutes: Math.max(1, Number(e.target.value) || pollFallback),
              }))
            }
            disabled={submitting}
          />
        </SettingsRow>
      </div>
    </SourceAddFormCard>
  );
}
