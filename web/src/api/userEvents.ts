/**
 * REST client for user-authored timed events (manual / assistant).
 */

import { apiClient } from "./client";
import type { components } from "./generated/schema";
import { SYSTEM_WORKSET_ID } from "../types/worksets";

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
  /** All-day uses ICS DATE semantics (wire end exclusive). */
  isAllDay?: boolean;
  /** Analysis-task provenance; `""` / omit → null. `"__user__"` stripped client-side. */
  taskId?: string | null;
  /** Ownership workset; `""` / `"__user__"` / omit → builtin system workset (LIVE). */
  worksetId?: string | null;
}

/** Strip fake `__user__` / blank provenance so it never hits the API as taskId. */
function normalizeWriteTaskId(taskId: string | null | undefined): string | null | undefined {
  if (taskId === undefined) return undefined;
  if (taskId === null) return null;
  const trimmed = taskId.trim();
  if (!trimmed || trimmed === SYSTEM_WORKSET_ID) return null;
  return trimmed;
}

export function listUserEvents(params?: {
  start?: string;
  end?: string;
  /** Analysis-task provenance id, or `""` for NULL provenance only. Not `__user__`. */
  taskId?: string;
  /** Ownership workset id (incl. builtin `__user__`). */
  worksetId?: string;
}): Promise<UserEvent[]> {
  const query: Record<string, string> = {};
  if (params?.start) query.start = params.start;
  if (params?.end) query.end = params.end;
  if (params?.taskId !== undefined) query.task_id = params.taskId;
  if (params?.worksetId !== undefined) query.workset_id = params.worksetId;
  return apiClient.get<UserEvent[]>("/api/v1/calendar/user-events", query);
}

export function createUserEvent(params: UserEventWriteParams): Promise<UserEvent> {
  const body: Record<string, unknown> = {
    title: params.title,
    startTime: params.startTime,
    endTime: params.endTime ?? null,
    body: params.body ?? "",
    location: params.location ?? "",
    isAllDay: Boolean(params.isAllDay),
  };
  const taskId = normalizeWriteTaskId(params.taskId);
  if (taskId !== undefined) body.taskId = taskId;
  if (params.worksetId !== undefined) body.worksetId = params.worksetId;
  return apiClient.post<UserEvent>("/api/v1/calendar/user-events", body);
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
  if (params.isAllDay !== undefined) body.isAllDay = params.isAllDay;
  if (params.taskId !== undefined) {
    body.taskId = normalizeWriteTaskId(params.taskId) ?? null;
  }
  if (params.worksetId !== undefined) body.worksetId = params.worksetId;
  return apiClient.patch<UserEvent>(`/api/v1/calendar/user-events/${id}`, body);
}

export function deleteUserEvent(id: string): Promise<void> {
  return apiClient.delete<void>(`/api/v1/calendar/user-events/${id}`);
}
