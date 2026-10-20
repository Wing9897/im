import type { RssAddFormProps } from "../types";
import { RssPresetFeedForm } from "../RssPresetFeedForm";

const HN_PRESET_IDS = [
  { id: "front", labelKey: "rssFields.hnFront", feedUrl: "https://hnrss.org/frontpage" },
  { id: "newest", labelKey: "rssFields.hnNewest", feedUrl: "https://hnrss.org/newest" },
  { id: "best", labelKey: "rssFields.hnBest", feedUrl: "https://hnrss.org/best" },
  { id: "show", labelKey: "rssFields.hnShow", feedUrl: "https://hnrss.org/show" },
  { id: "ask", labelKey: "rssFields.hnAsk", feedUrl: "https://hnrss.org/ask" },
] as const;

export function HackerNewsFeedForm(props: RssAddFormProps) {
  return (
    <RssPresetFeedForm
      {...props}
      presets={HN_PRESET_IDS}
      presetsLabelKey="rssFields.hnPresets"
      presetsHelpKey="rssFields.hnPresetsHelp"
      namePrefix="HN"
      idPrefix="hn"
      urlPlaceholder="https://hnrss.org/frontpage"
    />
  );
}
