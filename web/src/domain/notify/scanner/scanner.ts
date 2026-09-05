/**
 * Local-notify scanner façade (due / speak / dedupe).
 * Package lives under ``domain/notify/scanner`` — not Agent STT/TTS on ``/settings/ai/voice``.
 * Pure due/speak/dedupe logic: `scannerLogic`; fired-key persistence: `scannerFiredStore`.
 */

export { SCAN_INTERVAL_MS, type DueReminder, type TimedKeyEvent } from "./scannerTypes";
export {
  buildDedupeKey,
  buildPreviewSpeakText,
  buildSpeakText,
  collectDueReminders,
  computeFetchRange,
  filterEventsByNotify,
  formatLeadSpeakPhrase,
  getMaxLeadMinutes,
  isRemindAtDue,
  isWithinQuietHours,
  mergeTimedKeyEventsById,
  parseStartTimeFromDedupeKey,
  pruneFiredKeys,
  toTimedKeyEvents,
  userEventsToTimedKeyEvents,
} from "./scannerLogic";
export {
  claimFiredKeys,
  hydrateFiredKeys,
  loadFiredKeys,
  saveFiredKeys,
} from "./scannerFiredStore";
