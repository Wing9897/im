import { IMPORTANT_EVENT_EMOJI } from "../../api/timelineImportance";
import { itemDateKindEmoji } from "../items/itemCalendarProjection";

export type CalendarLeadingGlyph =
  | { type: "important"; emoji: typeof IMPORTANT_EVENT_EMOJI }
  | { type: "item"; emoji: string; itemDateKind: string | null | undefined };

/**
 * Single leading calendar glyph.
 * Priority: important ❗ > item remind 🔔; other item rows use the normal dot.
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
 * Month-cell preview title (remind keeps its i18n prefix from merge).
 */
export function monthPreviewTitle(event: {
  title: string;
  source?: string;
  itemDateKind?: string | null;
}): string {
  return event.title.trim();
}
