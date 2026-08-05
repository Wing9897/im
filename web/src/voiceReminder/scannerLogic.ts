/**
 * Voice-reminder pure logic façade.
 * State transitions: `scannerFiredLogic`; scan stepping: `scannerStep`; speak: `scannerSpeak`.
 */

export {
  buildDedupeKey,
  isWithinQuietHours,
  parseStartTimeFromDedupeKey,
  pruneFiredKeys,
} from "./scannerFiredLogic";

export {
  buildPreviewSpeakText,
  buildSpeakText,
  formatLeadSpeakPhrase,
} from "./scannerSpeak";

export {
  collectDueReminders,
  computeFetchRange,
  filterEventsBySourceFilter,
  getMaxLeadMinutes,
  isRemindAtDue,
  mergeTimedKeyEventsById,
  toTimedKeyEvents,
  userEventsToTimedKeyEvents,
} from "./scannerStep";
