/** REST API client functions for analysis task CRUD operations. */

import { apiClient } from "./client";
import type { components } from "./generated/schema";
import type {
  AnalysisTask,
  TaskConfig,
  TaskDeleteResult,
  TaskDraftPayload,
  TaskMutationResult,
  TaskTemplatePreset,
  TaskActivitySpan,
  AgentTickStatus,
} from "../types";

export type { TaskDraftPayload };

/** Atomic recurring create body - OpenAPI ``CreateRecurringTaskBody``. */
export type CreateRecurringTaskConfig = components["schemas"]["CreateRecurringTaskBody"];

/** Fetches all analysis tasks from the backend. */
export function listTasks(opts?: {
  topLevelOnly?: boolean;
  analysisMode?: string;
  worksetId?: string;
  /** Filter by ``recurring_schedules.item_id`` (empty string = unbound only). */
  itemId?: string;
}): Promise<AnalysisTask[]> {
  const query: Record<string, string> = {};
  if (opts?.topLevelOnly) query.topLevelOnly = "true";
  if (opts?.analysisMode) query.analysisMode = opts.analysisMode;
  if (opts?.worksetId !== undefined) query.worksetId = opts.worksetId;
  if (opts?.itemId !== undefined) query.itemId = opts.itemId;
  return Object.keys(query).length > 0
    ? apiClient.get<AnalysisTask[]>("/api/v1/tasks", query)
    : apiClient.get<AnalysisTask[]>("/api/v1/tasks");
}

/** Creates a new analysis task with the given configuration. */
export function createTask(task: TaskConfig): Promise<TaskMutationResult> {
  return apiClient.post<TaskMutationResult>("/api/v1/tasks", task);
}

/** Atomic recurring create: task + schedule in one request (timeline / web). */
export function createRecurringTask(
  body: CreateRecurringTaskConfig,
): Promise<TaskMutationResult> {
  return apiClient.post<TaskMutationResult>("/api/v1/tasks/recurring", body);
}

/** Updates an existing analysis task's configuration. */
export function updateTask(
  taskId: string,
  task: TaskConfig,
): Promise<TaskMutationResult> {
  return apiClient.put<TaskMutationResult>(`/api/v1/tasks/${taskId}`, task);
}

/** Deletes an analysis task and its associated results by ID. */
export function deleteTask(taskId: string): Promise<TaskDeleteResult> {
  return apiClient.delete<TaskDeleteResult>(`/api/v1/tasks/${taskId}`);
}

/** Toggle a task's active state. Returns the updated task (without channelIds). */
export function toggleTaskActive(taskId: string): Promise<Omit<AnalysisTask, "channelIds">> {
  return apiClient.patch<Omit<AnalysisTask, "channelIds">>(`/api/v1/tasks/${taskId}/active`);
}

/** Fetches available task template presets for the task creation wizard. */
export function listTaskTemplatePresets(): Promise<TaskTemplatePreset[]> {
  return apiClient.get<TaskTemplatePreset[]>("/api/v1/tasks/templates");
}

/** Fetches activity time spans for all tasks (used in timeline visualization). */
export function fetchTaskActivitySpans(): Promise<TaskActivitySpan[]> {
  return apiClient.get<TaskActivitySpan[]>("/api/v1/tasks/activity-spans");
}

/** Cursor backlog + recent agent-tick success/skip/error log. */
export function fetchAgentTickStatus(
  taskId: string,
  opts?: { limit?: number },
): Promise<AgentTickStatus> {
  const query: Record<string, string> = {};
  if (opts?.limit != null) query.limit = String(opts.limit);
  return Object.keys(query).length > 0
    ? apiClient.get<AgentTickStatus>(`/api/v1/tasks/${taskId}/agent-ticks`, query)
    : apiClient.get<AgentTickStatus>(`/api/v1/tasks/${taskId}/agent-ticks`);
}
