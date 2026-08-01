/**
 * Recurring calendar schedule subresource for analysisMode=recurring tasks.
 */

import { apiClient } from "./client";
import type { components } from "./generated/schema";

/** Schedule row from ``GET /tasks/{id}/schedule``. */
export type TaskSchedule = components["schemas"]["TaskScheduleResponse"];

/** Write body for ``PUT /tasks/{id}/schedule``. */
export type TaskScheduleConfig = components["schemas"]["TaskScheduleBody"];

export function fetchTaskSchedule(taskId: string): Promise<TaskSchedule> {
  return apiClient.get<TaskSchedule>(`/api/v1/tasks/${taskId}/schedule`);
}

export function putTaskSchedule(
  taskId: string,
  body: TaskScheduleConfig,
): Promise<TaskSchedule> {
  return apiClient.put<TaskSchedule>(`/api/v1/tasks/${taskId}/schedule`, body);
}

export function deleteTaskSchedule(taskId: string): Promise<void> {
  return apiClient.delete<void>(`/api/v1/tasks/${taskId}/schedule`);
}
