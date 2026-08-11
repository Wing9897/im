import { apiClient } from "./client";

export type TimelineImportanceSource = "analysis" | "user" | "recurring" | "item_remind";

export type TimelineImportance = {
  source: TimelineImportanceSource;
  eventId: string;
  markedAt: string;
};

/** Display glyph for important timeline markers. */
export const IMPORTANT_EVENT_EMOJI = "❗";

export function markTimelineImportant(
  source: TimelineImportanceSource,
  eventId: string,
): Promise<TimelineImportance> {
  return apiClient.put<TimelineImportance>("/api/v1/calendar/importance", {
    source,
    eventId,
  });
}

export function unmarkTimelineImportant(
  source: TimelineImportanceSource,
  eventId: string,
): Promise<void> {
  const params = new URLSearchParams({ source, eventId });
  return apiClient.delete<void>(`/api/v1/calendar/importance?${params.toString()}`);
}

export function listTimelineImportance(
  source?: TimelineImportanceSource,
): Promise<TimelineImportance[]> {
  return apiClient.get<TimelineImportance[]>(
    "/api/v1/calendar/importance",
    source != null ? { source } : undefined,
  );
}

/** Map TimelineItem.source to the importance table source. */
export function timelineItemImportanceSource(
  source: string | undefined,
): TimelineImportanceSource {
  if (source === "user") return "user";
  if (source === "recurring") return "recurring";
  if (source === "item_remind") return "item_remind";
  return "analysis";
}
