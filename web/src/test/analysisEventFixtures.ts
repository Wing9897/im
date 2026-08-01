import type { AnalysisEvent, TimelineItem } from "../types";

/** Creates an AnalysisEvent with sensible defaults for tests. */
export function makeAnalysisEvent(
  overrides: Partial<AnalysisEvent> = {},
): AnalysisEvent {
  return {
    id: "evt-1",
    taskId: "task-1",
    version: 1,
    batchId: "batch-1",
    title: "Test event",
    body: "Event body",
    startTime: null,
    endTime: null,
    location: null,
    latitude: null,
    longitude: null,
    participants: [],
    sourceMessageId: null,
    sourcePlatform: null,
    sourceChannelName: null,
    sourceMessageTime: null,
    analysisTimeRange: null,
    batchSourceChannelNames: [],
    taskName: null,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

/** Timed timeline fixture (`startTime` required). */
export function makeTimelineItem(
  overrides: Partial<TimelineItem> = {},
): TimelineItem {
  return makeAnalysisEvent({
    startTime: "2025-01-15T09:00:00Z",
    endTime: "2025-01-15T10:00:00Z",
    body: "Kickoff meeting summary",
    title: "Kickoff Meeting",
    ...overrides,
  }) as TimelineItem;
}
