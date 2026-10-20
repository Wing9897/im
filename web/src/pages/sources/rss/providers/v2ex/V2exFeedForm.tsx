import type { RssAddFormProps } from "../types";
import { RssPresetFeedForm } from "../RssPresetFeedForm";

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

export function V2exFeedForm(props: RssAddFormProps) {
  return (
    <RssPresetFeedForm
      {...props}
      presets={V2EX_PRESET_IDS}
      presetsLabelKey="rssFields.v2exPresets"
      presetsHelpKey="rssFields.v2exPresetsHelp"
      namePrefix="V2EX"
      idPrefix="v2ex"
      urlPlaceholder="https://www.v2ex.com/feed/tab/all.xml"
    />
  );
}
