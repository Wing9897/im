import { dismissTimelineEvent } from "../../api/timelineDismissals";

/** Soft-hide an analysis intel event via timeline_dismissals (source=analysis). */
export function dismissAnalysisEvent(eventId: string): Promise<unknown> {
  return dismissTimelineEvent("analysis", eventId);
}
