import type { CalendarShareEvent } from "../../api/calendarShare";
import type { TimelineItem } from "../../types";
import { asTimedAnalysisEvent } from "../../types/timelineItem";
import { isSubscribedTimelineSource, subscribedTimelineSource } from "./subscribedCalendars";

function subscribedSeriesId(event: CalendarShareEvent): string | null {
  const seriesId = typeof event.seriesId === "string" ? event.seriesId.trim() : "";
  return seriesId.length > 0 ? seriesId : null;
}

function projectedSource(event: CalendarShareEvent): string | undefined {
  const handle = typeof event.handle === "string" ? event.handle.trim() : "";
  const slug = typeof event.slug === "string" ? event.slug.trim() : "";
  if (handle && slug) return subscribedTimelineSource(handle, slug);
  return event.source;
}

/** Project a calendar-share proxy event into a read-only timeline item. */
export function calendarShareEventToTimelineItem(event: CalendarShareEvent): TimelineItem | null {
  const source = projectedSource(event);
  if (!isSubscribedTimelineSource(source)) return null;
  return asTimedAnalysisEvent({
    id: event.id,
    taskId: null,
    seriesId: subscribedSeriesId(event),
    version: 1,
    batchId: "",
    title: event.title,
    body: event.body ?? "",
    startTime: event.startTime ?? null,
    endTime: event.endTime ?? null,
    location: event.location ?? null,
    latitude: null,
    longitude: null,
    participants: [],
    sourceMessageId: null,
    sourceChannelName: null,
    sourcePlatform: null,
    sourceMessageTime: null,
    analysisTimeRange: null,
    batchSourceChannelNames: [],
    taskName: event.taskName ?? (event.handle && event.slug ? `${event.handle}/${event.slug}` : null),
    createdAt: event.startTime ?? "",
    updatedAt: event.startTime ?? "",
    source,
    isAllDay: Boolean(event.isAllDay),
    timezone: event.timezone ?? null,
    emoji: event.emoji ?? null,
    isLastOccurrence: Boolean(event.isLastOccurrence),
    dismissed: Boolean(event.dismissed),
    important: Boolean(event.important),
  });
}

export function projectSubscribedTimelineItems(events: readonly CalendarShareEvent[]): TimelineItem[] {
  const items: TimelineItem[] = [];
  for (const event of events) {
    const item = calendarShareEventToTimelineItem(event);
    if (item) items.push(item);
  }
  return items;
}
