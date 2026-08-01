/**
 * Recurring calendar schedule subresource for analysisMode=recurring tasks.
 */

import { apiClient } from "./client";

export type TaskSchedule = {
  taskId: string;
  rrule: string;
  eventStartTime?: string | null;
  eventEndTime?: string | null;
  eventIsAllDay?: boolean;
  eventLocation?: string | null;
  eventDescription?: string | null;
  eventTimezone?: string | null;
  eventStartLocal?: string | null;
  eventEndLocal?: string | null;
  eventExdates?: string[];
  eventRdates?: string[];
  icsUid?: string | null;
  icsSource?: string | null;
  parentTaskId?: string | null;
};

export type TaskScheduleConfig = {
  rrule: string;
  eventStartTime?: string | null;
  eventEndTime?: string | null;
  eventIsAllDay?: boolean;
  eventLocation?: string | null;
  eventDescription?: string | null;
  parentTaskId?: string | null;
};

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
