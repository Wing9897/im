import { apiClient } from "../client";
import type { components } from "../generated/schema";

export type TimelineEventStatusPayload = NonNullable<
  components["schemas"]["TimelineAnnotationsResponse"]["eventStatuses"]
> extends Record<string, infer V>
  ? V
  : never;
export type TimelineEventTimeOverridePayload =
  components["schemas"]["TimelineEventTimeOverrideSchema"];
export type TimelineAnnotationsPayload =
  components["schemas"]["TimelineAnnotationsPutBody"];
export type TimelineAnnotationsResponse =
  components["schemas"]["TimelineAnnotationsResponse"];

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
