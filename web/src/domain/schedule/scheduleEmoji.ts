/**
 * Shared keys for 我的日程 card emojis (`ui_prefs.schedule_emojis`).
 *
 * Store shape: `{ emojis: { "oneOff:<userEventId>": "🎂", "recurring:<seriesId>": "🔁" } }`.
 * Timeline occurrences use a different row id (`{seriesId}:{start}`); look up via
 * `seriesId`, never the occurrence id.
 */

export type ScheduleEmojiKind = "oneOff" | "recurring";

export function scheduleEmojiStorageKey(kind: ScheduleEmojiKind, id: string): string {
  return `${kind}:${id.trim()}`;
}

export type ScheduleEmojiEventRef = {
  id?: string | null;
  source?: string | null;
  seriesId?: string | null;
};

/**
 * Pref key for a timeline/board row, or `null` when the row is not a 我的日程 item
 * (analysis / item_remind) or the id is missing.
 */
export function scheduleEmojiKeyForTimelineEvent(event: ScheduleEmojiEventRef): string | null {
  if (event.source === "user") {
    const id = (event.id ?? "").trim();
    return id ? scheduleEmojiStorageKey("oneOff", id) : null;
  }
  if (event.source === "recurring") {
    const seriesId = (event.seriesId ?? "").trim();
    return seriesId ? scheduleEmojiStorageKey("recurring", seriesId) : null;
  }
  return null;
}

export function lookupScheduleEmoji(
  emojis: Readonly<Record<string, string>>,
  event: ScheduleEmojiEventRef,
): string {
  const key = scheduleEmojiKeyForTimelineEvent(event);
  if (!key) return "";
  const glyph = emojis[key];
  return typeof glyph === "string" ? glyph.trim() : "";
}
