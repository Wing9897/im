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
 * Persisted task returned by list/create/update. The generated response allows
 * route-specific omissions (toggle omits channelIds); this list-domain shape
 * records the fields the task catalog guarantees.
 */
export type AnalysisTask = Omit<
  TaskResponse,
  | "description"
  | "analysisTimeRange"
  | "channelIds"
  | "eventIsAllDay"
  | "includeInTimeline"
  | "createdAt"
  | "updatedAt"
> & {
  description: string | null;
  analysisTimeRange: AnalysisTimeRange;
  channelIds: ChannelRef[];
  eventIsAllDay?: boolean | null;
  includeInTimeline?: boolean | null;
  createdAt: string;
  updatedAt: string;
};

/** Configuration payload for creating/updating an analysis task.
 * channelIds accepts synthetic "platform:platformId" strings from the form.
 *
 * Recurring-only recurrence expanded at query time — never an AI analysis trigger.
 * ``rrule`` / calendar wall-clock fields belong on recurring tasks only.
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


