/**
 * REST client for user-authored timed events (manual / assistant).
 */

import { apiClient } from "./client";
import type { components } from "./generated/schema";

export type UserEvent = Omit<
  components["schemas"]["UserEventResponse"],
  "dismissed"
> & {
  /** Optional only for legacy in-memory fixtures; API responses always include it. */
  dismissed?: boolean;
};

export type UserEventOrigin = UserEvent["origin"];

interface UserEventWriteParams {
  title: string;
  startTime: string;
  endTime?: string | null;
  body?: string;
  location?: string;
  /** `""` / `"__user__"` / omit → unassigned; real id → event|recurring|calendar_task task. */
  taskId?: string | null;
}

export function listUserEvents(params?: {
  start?: string;
  end?: string;
  /** Owning analysis task id, or `""` / `"__user__"` for unassigned only. */
  taskId?: string;
}): Promise<UserEvent[]> {
  const query: Record<string, string> = {};
  if (params?.start) query.start = params.start;
  if (params?.end) query.end = params.end;
  if (params?.taskId !== undefined) query.task_id = params.taskId;
  return apiClient.get<UserEvent[]>("/api/v1/user-events", query);
}

export function createUserEvent(params: UserEventWriteParams): Promise<UserEvent> {
  const body: Record<string, unknown> = {
    title: params.title,
    startTime: params.startTime,
    endTime: params.endTime ?? null,
    body: params.body ?? "",
    location: params.location ?? "",
  };
  if (params.taskId !== undefined) body.taskId = params.taskId;
  return apiClient.post<UserEvent>("/api/v1/user-events", body);
}

export function updateUserEvent(
  id: string,
  params: Partial<UserEventWriteParams>,
): Promise<UserEvent> {
  const body: Record<string, unknown> = {};
  if (params.title !== undefined) body.title = params.title;
  if (params.startTime !== undefined) body.startTime = params.startTime;
  if (params.endTime !== undefined) body.endTime = params.endTime;
  if (params.body !== undefined) body.body = params.body;
  if (params.location !== undefined) body.location = params.location;
  if (params.taskId !== undefined) body.taskId = params.taskId;
  return apiClient.patch<UserEvent>(`/api/v1/user-events/${id}`, body);
}

export function deleteUserEvent(id: string): Promise<void> {
  return apiClient.delete<void>(`/api/v1/user-events/${id}`);
}
