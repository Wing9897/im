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
type TaskTriggerMode = NonNullable<components["schemas"]["TaskConfigBody"]["triggerMode"]>;

/**
 * OpenAPI ``TaskResponse.required`` — Pydantic defaults are not required on the wire.
 * Do not treat generated ``schema.d.ts`` defaulted fields as required.
 */
type AnalysisTaskRequired = Pick<
  TaskResponse,
  "id" | "name" | "version" | "isActive" | "llmProfileId" | "worksetId"
>;

/**
 * Persisted analysis task returned by list/create/update.
 * Standalone recurring calendar series use ``/api/v1/calendar/recurring``, not this type.
 */
export type AnalysisTask = AnalysisTaskRequired &
  Omit<
    Partial<TaskResponse>,
    keyof AnalysisTaskRequired | "analysisTimeRange" | "analysisMode" | "triggerMode"
  > & {
    analysisTimeRange: TaskAnalysisTimeRange;
    analysisMode: AnalysisMode;
    triggerMode?: TaskTriggerMode;
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
