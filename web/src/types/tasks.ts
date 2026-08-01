// ============================================================
// Task Type Definitions
// ============================================================

import type { components } from "../api/generated/schema";
import type { AnalysisMode, AnalysisTimeRange } from "./common";

/** Wire shape for chat-assistant ``currentTask`` / ``taskConfig`` (OpenAPI). */
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
  analysisTimeRange: AnalysisTimeRange;
  channelIds: ChannelRef[];
  includeInTimeline?: boolean | null;
  createdAt: string;
  updatedAt: string;
};

/** Configuration payload for creating/updating an analysis task.
 * channelIds accepts synthetic "platform:platformId" strings from the form.
 */
export type TaskConfig = Omit<
  components["schemas"]["TaskConfigBody"],
  "analysisMode" | "analysisTimeRange" | "channelIds"
> & {
  analysisMode?: AnalysisMode | null;
  analysisTimeRange?: AnalysisTimeRange | null;
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
  defaultAnalysisTimeRange: AnalysisTimeRange;
  badge: string;
}

/** Raw reply from POST /tasks/chat-assistant. `taskConfig` is AI-generated
 * and must still be validated field-by-field (see parseTaskAssistantResponse). */
export interface TaskAssistantReply {
  message: string;
  taskConfig: TaskDraftPayload | null;
}
