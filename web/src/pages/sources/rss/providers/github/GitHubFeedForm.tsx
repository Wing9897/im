import { githubAtomUrl } from "../rssUrlPatterns";
import type { RssAddFormProps } from "../types";
import { RssPresetFeedForm } from "../RssPresetFeedForm";

const GITHUB_REPO_PRESETS = [
  {
    id: "torvalds-linux",
    labelKey: "torvalds/linux",
    feedUrl: githubAtomUrl("torvalds/linux", "releases"),
  },
  {
    id: "nodejs-node",
    labelKey: "nodejs/node",
    feedUrl: githubAtomUrl("nodejs/node", "releases"),
  },
  {
    id: "microsoft-vscode",
    labelKey: "microsoft/vscode",
    feedUrl: githubAtomUrl("microsoft/vscode", "releases"),
  },
] as const;

export function GitHubFeedForm(props: RssAddFormProps) {
  return (
    <RssPresetFeedForm
      {...props}
      presets={GITHUB_REPO_PRESETS}
      presetsLabelKey="rssFields.popularRepos"
      namePrefix="GitHub"
      idPrefix="github"
      urlPlaceholder="https://github.com/owner/repo/releases.atom"
      urlLabelKey="rssFields.atomUrl"
      urlHelpKey="rssFields.atomHelp"
      pollFallback={15}
      translateLabels={false}
      atomKinds
    />
  );
}
