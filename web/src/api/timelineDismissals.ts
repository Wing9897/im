/**
 * REST client for timeline soft-dismiss markers.
 *
 * The transport remains hand-written; response/source shapes come from the
 * committed OpenAPI schema.
 */

import { apiClient } from "./client";
import type { components } from "./generated/schema";

export type TimelineDismissal = components["schemas"]["TimelineDismissalResponse"];
export type TimelineDismissalSource = TimelineDismissal["source"];

export function dismissTimelineEvent(
  source: TimelineDismissalSource,
  eventId: string,
): Promise<TimelineDismissal> {
  return apiClient.put<TimelineDismissal>("/api/v1/calendar/dismissals", {
    source,
    eventId,
  });
}

export function restoreTimelineEvent(
  source: TimelineDismissalSource,
  eventId: string,
): Promise<void> {
  const params = new URLSearchParams({ source, eventId });
  return apiClient.delete<void>(`/api/v1/calendar/dismissals?${params.toString()}`);
}

export function listTimelineDismissals(
  source?: TimelineDismissalSource,
): Promise<TimelineDismissal[]> {
  const query: Record<string, string> = {};
  if (source) query.source = source;
  return apiClient.get<TimelineDismissal[]>("/api/v1/calendar/dismissals", query);
}

/** Map TimelineItem.source to the dismissals table source. */
export function timelineItemDismissalSource(
  source: string | undefined,
): TimelineDismissalSource {
  if (source === "user") return "user";
  if (source === "recurring") return "recurring";
  if (source === "item_remind") return "item_remind";
  return "analysis";
}
