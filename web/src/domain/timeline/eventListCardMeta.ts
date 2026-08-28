/**
 * Right-sidebar event-card affiliation + generation provenance labels.
 *
 * Re-export barrel — import from here to keep existing paths stable.
 */

export {
  previewEventBody,
  eventListTimeLabel,
  eventShowsRemindBadge,
  type EventListDayPhaseTag,
  EVENT_LIST_DAY_PHASE_TAG_META,
  EVENT_LIST_DAY_PHASE_TAG_CLASS,
  resolveEventListDayPhaseTag,
  eventListCardTitle,
  calendarLocationDisplay,
  type EventCardDisplay,
  resolveEventCardDisplay,
} from "./eventListDisplay";

export {
  type EventListCardMetaLookups,
  resolveEventListWorksetName,
  type EventListProvenanceKind,
  resolveEventListProvenanceKind,
  resolveEventListTaskName,
  resolveSubscribedCalendarPath,
  eventListShowsWorksetAffiliation,
  eventListShowsProvenance,
  resolveSubscribedCalendarDescription,
  formatEventListAffiliationLabel,
  formatEventListProvenanceLabel,
  eventListAllowsDismiss,
} from "./eventListProvenance";
