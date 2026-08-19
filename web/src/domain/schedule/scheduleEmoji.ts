/**
 * Schedule card glyphs live on entity ``emoji`` (user_events / recurring_schedules).
 * Empty / missing → CalendarDays / Repeat product logos.
 */

export type ScheduleEmojiEventRef = {
  source?: string | null;
  emoji?: string | null;
};

export function lookupScheduleEmoji(event: ScheduleEmojiEventRef): string {
  if (event.source !== "user" && event.source !== "recurring") return "";
  return typeof event.emoji === "string" ? event.emoji.trim() : "";
}
