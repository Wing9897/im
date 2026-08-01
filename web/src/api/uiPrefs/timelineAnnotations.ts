import { apiClient } from "../client";

export type TimelineEventStatusPayload = "pending" | "confirmed" | "completed";

export type TimelineEventTimeOverridePayload = {
  startTime: string;
  endTime: string | null;
};

export type TimelineAnnotationsPayload = {
  eventStatuses: Record<string, TimelineEventStatusPayload>;
  eventTimeOverrides: Record<string, TimelineEventTimeOverridePayload>;
};

export type TimelineAnnotationsResponse = {
  configured: boolean;
  eventStatuses: Record<string, TimelineEventStatusPayload> | null;
  eventTimeOverrides: Record<string, TimelineEventTimeOverridePayload> | null;
};

const TIMELINE_ANNOTATIONS_PATH = "/api/v1/ui-prefs/timeline/annotations";

/** GET timeline client annotations (`configured: false` when unset). */
export function fetchTimelineAnnotations(): Promise<TimelineAnnotationsResponse> {
  return apiClient.get<TimelineAnnotationsResponse>(TIMELINE_ANNOTATIONS_PATH);
}

/** PUT full timeline annotations blob (statuses + time overrides). */
export function putTimelineAnnotations(
  body: TimelineAnnotationsPayload,
): Promise<TimelineAnnotationsResponse> {
  return apiClient.put<TimelineAnnotationsResponse>(TIMELINE_ANNOTATIONS_PATH, body);
}
