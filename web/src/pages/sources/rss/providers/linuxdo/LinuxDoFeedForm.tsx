import type { RssAddFormProps } from "../types";
import { RssPresetFeedForm } from "../RssPresetFeedForm";

const LINUX_DO_PRESET_IDS = [
  { id: "latest", labelKey: "rssFields.linuxdoLatest", feedUrl: "https://linux.do/latest.rss" },
  { id: "top", labelKey: "rssFields.linuxdoTop", feedUrl: "https://linux.do/top.rss" },
  { id: "posts", labelKey: "rssFields.linuxdoPosts", feedUrl: "https://linux.do/posts.rss" },
] as const;

export function LinuxDoFeedForm(props: RssAddFormProps) {
  return (
    <RssPresetFeedForm
      {...props}
      presets={LINUX_DO_PRESET_IDS}
      presetsLabelKey="rssFields.linuxdoPresets"
      presetsHelpKey="rssFields.linuxdoPresetsHelp"
      namePrefix="LINUX.DO"
      idPrefix="linuxdo"
      urlPlaceholder="https://linux.do/latest.rss"
    />
  );
}
