// ============================================================
// Task Type Definitions
// ============================================================

import type { components } from "../api/generated/schema";
import type { AnalysisMode, TaskAnalysisTimeRange } from "./common";

/** Wire shape for task-advisor ``currentTask`` / ``taskConfig`` (OpenAPI). */
export type TaskDraftPayload = components["schemas"]["TaskDraftPayload"];

/** Channel reference in task associations */
type ChannelRef = components["schemas"]["ChannelRefResponse"];

type TaskResponse = components["schemas"]["TaskResponse"];

/**
 * Persisted task returned by list/create/update. Recurring calendar fields live
 * on ``GET/PUT /api/v1/tasks/{id}/schedule``, not on the task body.
 *
 * Recurring-only recurrence expanded at query time — never an AI analysis trigger.
 */
export type AnalysisTask = Omit<
  TaskResponse,
  | "description"
  | "analysisTimeRange"
  | "channelIds"
  | "includeInTimeline"
  | "createdAt"
  | "updatedAt"
> & {
  description: string | null;
  analysisTimeRange: TaskAnalysisTimeRange;
  channelIds: ChannelRef[];
  includeInTimeline?: boolean | null;
  createdAt: string;
  updatedAt: string;
  /** Agent policy (stamp 19+); optional until OpenAPI regenerates. */
  triggerMode?: "schedule" | "message_cursor" | "message_threshold";
  capCalendarRead?: boolean;
  capCalendarWrites?: boolean;
  capWebSearch?: boolean;
  capForceWebSearch?: boolean;
  capReadAnalysisEvents?: boolean;
  capReadItems?: boolean;
  outputCalendar?: boolean;
  outputAnalysisEvents?: boolean;
  /** Parent inventory item for recurring calendars (``recurring_schedules.item_id``). */
  itemId?: string | null;
};

/** Configuration payload for creating/updating an analysis task.
 * channelIds accepts synthetic "platform:platformId" strings from the form.
 */
export type TaskConfig = Omit<
  components["schemas"]["TaskConfigBody"],
  "analysisMode" | "analysisTimeRange" | "channelIds"
> & {
  analysisMode?: AnalysisMode | null;
  analysisTimeRange?: TaskAnalysisTimeRange | null;
  channelIds?: string[] | ChannelRef[];
};

export type TaskMutationResult = AnalysisTask & { deletedBatchCount: number };

export type TaskDeleteResult = components["schemas"]["TaskDeleteResponse"];

export interface TaskTemplatePreset {
  id: string;
  name: string;
  description: string;
  analysisMode: AnalysisMode;
  promptTemplate: string;
  defaultAnalysisTimeRange: TaskAnalysisTimeRange;
  badge: string;
  /** Language-neutral search keywords for agent web_scout presets (optional). */
  webSearchQuery?: string;
}
