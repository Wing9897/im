/**
 * Display helpers for 我的日程 cards (schedule page, board widget, timeline
 * user/recurring rows). Empty location / notes always render a token (N/A).
 */

/** Timeline sources that belong to 「我的日程」, not analysis intel cards. */
export function isUserScheduleTimelineEvent(
  source: string | null | undefined,
): boolean {
  return source === "user" || source === "recurring";
}

/**
 * Trimmed field text, or `emptyLabel` when blank / whitespace / legacy "N/A".
 */
export function scheduleCardText(
  raw: string | null | undefined,
  emptyLabel: string,
): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed || trimmed.toUpperCase() === "N/A") return emptyLabel;
  return trimmed;
}
