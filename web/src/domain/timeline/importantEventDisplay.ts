import { IMPORTANT_EVENT_EMOJI } from "../../api/timelineImportance";
import {
  itemDateKindEmoji,
  stripItemKindTitlePrefix,
} from "../items/itemCalendarProjection";

export type CalendarLeadingGlyph =
  | { type: "important"; emoji: typeof IMPORTANT_EVENT_EMOJI }
  | { type: "item"; emoji: string; itemDateKind: string | null | undefined };

/**
 * Single leading calendar glyph.
 * Priority: important ❗ > item remind 🔔; purchased / expires use the normal dot.
 */
export function resolveCalendarLeadingGlyph(event: {
  important?: boolean | null;
  source?: string;
  itemDateKind?: string | null;
}): CalendarLeadingGlyph | null {
  if (event.important) {
    return { type: "important", emoji: IMPORTANT_EVENT_EMOJI };
  }
  if (event.source === "item" && event.itemDateKind === "remind") {
    return {
      type: "item",
      emoji: itemDateKindEmoji("remind"),
      itemDateKind: "remind",
    };
  }
  return null;
}

/**
 * Month-cell preview title: plain for purchased / expires; remind keeps its prefix.
 */
export function monthPreviewTitle(event: {
  title: string;
  source?: string;
  itemDateKind?: string | null;
}): string {
  const base = event.title.trim();
  if (event.source !== "item") return base;
  if (event.itemDateKind === "purchased" || event.itemDateKind === "expires") {
    return stripItemKindTitlePrefix(event.itemDateKind, base);
  }
  return base;
}
