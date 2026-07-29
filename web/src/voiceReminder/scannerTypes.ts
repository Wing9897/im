/** Shared types / cadence constants for the voice-reminder scanner. */

/** Default scan cadence used by the hook and window math. */
export const SCAN_INTERVAL_MS = 60_000;

/** Extra look-ahead when fetching events beyond max lead. */
export const FETCH_BUFFER_MS = 5 * 60_000;

/**
 * How far back from `now` a remindAt may still fire (covers late tabs / missed ticks).
 * Equals one scan interval so a single missed poll is recoverable.
 */
export const SCAN_GRACE_MS = SCAN_INTERVAL_MS;

/** Keep fired keys until this long after the event start. */
export const FIRED_RETAIN_AFTER_START_MS = 2 * 24 * 60 * 60_000;

/** Source kind for speak-text wording (default: analysis 關鍵事件). */
export type TimedKeyEventKind = "event" | "recurring" | "user";

/** Timed items used by the reminder scanner (analysis / calendar / user events). */
export interface TimedKeyEvent {
  id: string;
  taskId: string | null;
  taskName: string;
  title: string;
  startTime: string;
  kind?: TimedKeyEventKind;
}

export interface DueReminder {
  eventId: string;
  taskId: string | null;
  taskName: string;
  title: string;
  startTime: string;
  leadOffsetMinutes: number;
  remindAtMs: number;
  dedupeKey: string;
  speakText: string;
}
