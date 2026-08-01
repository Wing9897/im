/**
 * REST API client functions for analysis task CRUD operations.
 *
 * Requirements: 12.1, 12.4
 */

import { apiClient } from "./client";
import type {
  AnalysisTask,
  TaskAssistantReply,
  TaskConfig,
  TaskDeleteResult,
  TaskDraftPayload,
  TaskMutationResult,
  TaskTemplatePreset,
  TaskActivitySpan,
  ProjectTickStatus,
} from "../types";

export type { TaskDraftPayload };

/** Fetches all analysis tasks from the backend. */
export function listTasks(opts?: {
  topLevelOnly?: boolean;
  analysisMode?: string;
}): Promise<AnalysisTask[]> {
  const query: Record<string, string> = {};
  if (opts?.topLevelOnly) query.top_level_only = "true";
  if (opts?.analysisMode) query.analysis_mode = opts.analysisMode;
  return Object.keys(query).length > 0
    ? apiClient.get<AnalysisTask[]>("/api/v1/tasks", query)
    : apiClient.get<AnalysisTask[]>("/api/v1/tasks");
}

/** Creates a new analysis task with the given configuration. */
export function createTask(task: TaskConfig): Promise<TaskMutationResult> {
  return apiClient.post<TaskMutationResult>("/api/v1/tasks", task);
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

/** Cursor backlog + recent project-tick success/skip/error log. */
export function fetchProjectTickStatus(
  taskId: string,
  opts?: { limit?: number },
): Promise<ProjectTickStatus> {
  const query: Record<string, string> = {};
  if (opts?.limit != null) query.limit = String(opts.limit);
  return Object.keys(query).length > 0
    ? apiClient.get<ProjectTickStatus>(`/api/v1/tasks/${taskId}/project-ticks`, query)
    : apiClient.get<ProjectTickStatus>(`/api/v1/tasks/${taskId}/project-ticks`);
}

/** Sends a chat message to the AI task assistant for task configuration guidance. */
export function chatTaskAssistant(params: {
  messages: { role: string; content: string }[];
  currentTask?: TaskDraftPayload | null;
  /** UI locale for AI output language; server falls back to ``ui_locale``. */
  locale?: string;
}): Promise<TaskAssistantReply> {
  return apiClient.post<TaskAssistantReply>("/api/v1/tasks/chat-assistant", params);
}
