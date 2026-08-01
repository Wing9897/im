import { useTranslation } from "react-i18next";
import { Button, SettingsRow, TextField } from "../../../../../components/ui";
import { SourceAddFormCard } from "../../../SourceAddFormCard";
import type { RssAddFormProps } from "../types";
import { githubAtomUrl } from "../rssUrlPatterns";

const GITHUB_REPO_PRESETS = [
  { id: "torvalds-linux", label: "torvalds/linux", repo: "torvalds/linux" },
  { id: "nodejs-node", label: "nodejs/node", repo: "nodejs/node" },
  { id: "microsoft-vscode", label: "microsoft/vscode", repo: "microsoft/vscode" },
] as const;

const GITHUB_KIND_PRESETS = [
  { id: "releases", label: "Releases", kind: "releases" as const },
  { id: "tags", label: "Tags", kind: "tags" as const },
  { id: "commits", label: "Commits (master)", kind: "commits" as const },
];

export function GitHubFeedForm({
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
        <SettingsRow label={t("rssFields.popularRepos")}>
          <div className="flex flex-wrap gap-sm">
            {GITHUB_REPO_PRESETS.map((preset) => (
              <Button
                key={preset.id}
                size="sm"
                variant="secondary"
                disabled={submitting}
                onClick={() => {
                  setFields((prev) => ({
                    ...prev,
                    feedUrl: githubAtomUrl(preset.repo, "releases"),
                    name: prev.name.trim() ? prev.name : `GitHub · ${preset.label}`,
                  }));
                }}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </SettingsRow>

        <SettingsRow label={t("rssFields.feedKind")}>
          <div className="flex flex-wrap gap-sm">
            {GITHUB_KIND_PRESETS.map((preset) => (
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

        <SettingsRow label={t("rssFields.atomUrl")} htmlFor="github-feed-url">
          <TextField
            id="github-feed-url"
            type="url"
            placeholder="https://github.com/owner/repo/releases.atom"
            value={fields.feedUrl}
            onChange={(e) => setFields((s) => ({ ...s, feedUrl: e.target.value }))}
            disabled={submitting}
          />
          <p className="mt-1 text-xs text-text-muted">{t("rssFields.atomHelp")}</p>
        </SettingsRow>

        <SettingsRow label={t("rssFields.displayName")} htmlFor="github-feed-name">
          <TextField
            id="github-feed-name"
            type="text"
            value={fields.name}
            onChange={(e) => setFields((s) => ({ ...s, name: e.target.value }))}
            disabled={submitting}
          />
        </SettingsRow>

        <SettingsRow label={t("rssFields.pollInterval")} htmlFor="github-poll-interval">
          <TextField
            id="github-poll-interval"
            type="number"
            min={1}
            max={1440}
            value={fields.pollIntervalMinutes}
            onChange={(e) =>
              setFields((s) => ({
                ...s,
                pollIntervalMinutes: Math.max(1, Number(e.target.value) || 15),
              }))
            }
            disabled={submitting}
          />
        </SettingsRow>
      </div>
    </SourceAddFormCard>
  );
}
