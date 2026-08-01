import type { AnalysisEvent } from "./analysisEvent";

/**
 * Timed analysis event for Timeline views (`startTime` required).
 */
export type TimelineItem = AnalysisEvent & { startTime: string };

/** Narrow an event to TimelineItem when startTime is present. */
export function asTimedAnalysisEvent(event: AnalysisEvent): TimelineItem | null {
  if (!event.startTime) return null;
  return event as TimelineItem;
}
