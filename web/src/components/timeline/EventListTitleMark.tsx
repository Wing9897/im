import { IntelEventMark } from "../task/IntelEventAvatarStack";
import { itemDateKindMarkerClass } from "../../domain/items/itemCalendarProjection";
import {
  resolveEventListProvenanceKind,
  type EventListCardMetaLookups,
} from "../../domain/timeline/eventListCardMeta";
import type { CalendarLeadingGlyph } from "../../domain/timeline/importantEventDisplay";
import { isUserScheduleTimelineEvent } from "../../domain/schedule/scheduleCardFields";
import type { TimelineItem } from "../../types";
import { ScheduleEventTitleMark } from "./ScheduleEventTitleMark";
import { SubscribedEventTitleMark } from "./SubscribedEventTitleMark";

/** Shared 28px title-row mark for list cards, day cards, and sidebar detail. */
export function EventListTitleMark({
  event,
  leading,
  metaLookups,
  eventAvatarAria,
  markerClassName = "mt-1",
  importantMarkerTestId = "timeline-important-marker",
  itemKindMarkerTestId = "timeline-item-kind-marker",
}: {
  event: TimelineItem;
  leading: CalendarLeadingGlyph | null;
  metaLookups?: EventListCardMetaLookups;
  eventAvatarAria: string;
  markerClassName?: string;
  importantMarkerTestId?: string;
  itemKindMarkerTestId?: string;
}) {
  if (leading) {
    return (
      <span
        className={`${markerClassName} ${itemDateKindMarkerClass(
          leading.type === "item" ? leading.itemDateKind : null,
        )}`.trim()}
        aria-hidden="true"
        data-testid={
          leading.type === "important" ? importantMarkerTestId : itemKindMarkerTestId
        }
      >
        {leading.emoji}
      </span>
    );
  }
  if (isUserScheduleTimelineEvent(event.source)) {
    return <ScheduleEventTitleMark event={event} />;
  }
  if (resolveEventListProvenanceKind(event) === "subscribed") {
    return (
      <SubscribedEventTitleMark
        event={event}
        catalogOwnerAvatarByHandle={metaLookups?.subscribeOwnerAvatarByHandle}
      />
    );
  }
  if (resolveEventListProvenanceKind(event) === "task") {
    return (
      <IntelEventMark event={event} size="compact" label={eventAvatarAria} />
    );
  }
  return null;
}
