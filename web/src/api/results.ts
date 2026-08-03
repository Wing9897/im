/**
 * REST API client functions for results and analysis queries.
 */

import { apiClient } from "./client";
import type {
  AnalysisEventPage,
  CalendarOccurrence,
  Message,
  QueueStatus,
  TaskAnalysisStats,
  TimelineItem,
  TrendingTopic,
} from "../types";
import { asTimedAnalysisEvent } from "../types/analysis";

/** Fetches trending topics, optionally filtered by task ID. */
export function fetchTrendingTopics(taskId?: string): Promise<TrendingTopic[]> {
  const params = taskId ? { task_id: taskId } : undefined;
  return apiClient.get<TrendingTopic[]>("/api/v1/results/trending", params);
}

/** Fetches a paginated list of unified analysis events with optional filters. */
export function fetchEvents(params: {
  taskId?: string;
  /** When set (including `[]`), wins over single `taskId`. */
  taskIds?: string[];
  search?: string;
  startDate?: string;
  endDate?: string;
  sort?: "event_time" | "analyzed_at";
  limit?: number;
  offset?: number;
  hasTime?: boolean;
  hasCoords?: boolean;
  /** When false, server skips COUNT(*) (`include_total=false`). Default true. */
  includeTotal?: boolean;
  /**
   * Time-planning views only. When true, sends `include_in_timeline=1` so the
   * server excludes tasks that opted out of calendar / gantt / timeline.
   */
  requireIncludeInTimeline?: boolean;
}): Promise<AnalysisEventPage> {
  if (params.taskIds !== undefined && params.taskIds.length === 0) {
    return Promise.resolve({
      items: [],
      totalCount: 0,
      hasMore: false,
      sort: params.sort ?? "event_time",
    });
  }
  const queryParams: Record<string, string | string[]> = {};
  if (params.taskIds !== undefined) {
    queryParams.task_ids = params.taskIds;
  } else if (params.taskId) {
    queryParams.task_id = params.taskId;
  }
  if (params.search) queryParams.search = params.search;
  if (params.startDate) queryParams.start_date = params.startDate;
  if (params.endDate) queryParams.end_date = params.endDate;
  if (params.sort) queryParams.sort = params.sort;
  if (params.limit !== undefined) queryParams.limit = String(params.limit);
  if (params.offset !== undefined) queryParams.offset = String(params.offset);
  if (params.hasTime !== undefined) queryParams.has_time = params.hasTime ? "1" : "0";
  if (params.hasCoords !== undefined) queryParams.has_coords = params.hasCoords ? "1" : "0";
  if (params.includeTotal === false) queryParams.include_total = "false";
  if (params.requireIncludeInTimeline === true) {
    queryParams.include_in_timeline = "1";
  }
  return apiClient.get<AnalysisEventPage>("/api/v1/results/events", queryParams);
}

/** Fetches the source messages associated with a specific topic. */
export function fetchTopicMessages(topicId: string): Promise<Message[]> {
  return apiClient.get<Message[]>(
    `/api/v1/results/trending/${topicId}/messages`,
  );
}

interface TimedEventWindow {
  taskId?: string;
  /** When set (including `[]`), wins over single `taskId`. */
  taskIds?: string[];
  startDate: string;
  endDate: string;
}

const TIMED_EVENT_PAGE_SIZE = 200;

/** Fetches every timed event in a bounded date window. */
export async function fetchTimelineEvents({
  taskId,
  taskIds,
  startDate,
  endDate,
}: TimedEventWindow): Promise<TimelineItem[]> {
  const items: AnalysisEventPage["items"] = [];
  let offset = 0;

  while (true) {
    const page = await fetchEvents({
      taskId,
      taskIds,
      startDate,
      endDate,
      hasTime: true,
      requireIncludeInTimeline: true,
      limit: TIMED_EVENT_PAGE_SIZE,
      offset,
      sort: "event_time",
    });
    items.push(...page.items);

    if (!page.hasMore || page.items.length === 0) {
      break;
    }
    offset += page.items.length;
  }

  return items
    .map(asTimedAnalysisEvent)
    .filter((event): event is TimelineItem => event !== null)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

/** Fetches expanded calendar-task + optional item DATE rows within an ISO range. */
export function fetchCalendarOccurrences(
  rangeStart: string,
  rangeEnd: string,
  opts?: { taskId?: string; taskIds?: string[]; includeItems?: boolean },
): Promise<CalendarOccurrence[]> {
  const query: Record<string, string | string[]> = {
    range_start: rangeStart,
    range_end: rangeEnd,
  };
  if (opts?.taskIds !== undefined) {
    query.task_ids = opts.taskIds;
  } else if (opts?.taskId !== undefined) {
    query.task_id = opts.taskId;
  }
  if (opts?.includeItems === false) {
    query.include_items = "false";
  }
  return apiClient.get<CalendarOccurrence[]>("/api/v1/calendar/items", query);
}

/** Fetches the current analysis queue status (pending count, processing batches, pause state). */
export function fetchQueueStatus(): Promise<QueueStatus> {
  return apiClient.get<QueueStatus>("/api/v1/results/queue");
}

/** Fetches per-task analysis statistics for the given time range. */
export function fetchTaskAnalysisStats(
  timeRange: string,
): Promise<TaskAnalysisStats[]> {
  return apiClient.get<TaskAnalysisStats[]>("/api/v1/results/stats", {
    time_range: timeRange,
  });
}

