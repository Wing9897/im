/**
 * Voice-reminder scanner façade.
 * Pure due/speak/dedupe logic: `scannerLogic`; fired-key persistence: `scannerFiredStore`.
 */

export { SCAN_INTERVAL_MS, type DueReminder, type TimedKeyEvent } from "./scannerTypes";
export {
  buildDedupeKey,
  buildPreviewSpeakText,
  buildSpeakText,
  collectDueReminders,
  computeFetchRange,
  filterEventsByTaskIds,
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
  resetFiredKeysCacheForTests,
  saveFiredKeys,
} from "./scannerFiredStore";
