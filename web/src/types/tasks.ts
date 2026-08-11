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
 * Persisted analysis task returned by list/create/update.
 * Standalone recurring calendar series use ``/api/v1/calendar/recurring``, not this type.
 */
export type AnalysisTask = Omit<
  TaskResponse,
  | "description"
  | "analysisTimeRange"
  | "analysisMode"
  | "channelIds"
  | "includeInTimeline"
  | "createdAt"
  | "updatedAt"
> & {
  description: string | null;
  analysisTimeRange: TaskAnalysisTimeRange;
  analysisMode: AnalysisMode;
  channelIds: ChannelRef[];
  includeInTimeline?: boolean | null;
  createdAt: string;
  updatedAt: string;
  triggerMode?: "schedule" | "message_cursor" | "message_threshold";
  capCalendarRead?: boolean;
  capCalendarWrites?: boolean;
  capWebSearch?: boolean;
  capForceWebSearch?: boolean;
  capReadAnalysisEvents?: boolean;
  capReadItems?: boolean;
  outputCalendar?: boolean;
  outputAnalysisEvents?: boolean;
  llmProfileId?: string;
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
  /** LLM profile id; omit / null on create → server default. */
  llmProfileId?: string | null;
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
}
