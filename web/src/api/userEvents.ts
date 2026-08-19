/**
 * REST client for user-authored timed events (manual / assistant / mcp / …).
 * Wire shape is OpenAPI ``UserEventResponse`` (origin includes ``mcp``).
 */

import { apiClient } from "./client";
import type { components } from "./generated/schema";
import { normalizeNotifyPref } from "../domain/notify/notifyPref";
import { SYSTEM_WORKSET_ID } from "../types/worksets";

export type UserEvent = components["schemas"]["UserEventResponse"];
export type UserEventsPage = components["schemas"]["UserEventsPageResponse"];
export type UserEventOrigin = UserEvent["origin"];

interface UserEventWriteParams {
  title: string;
  startTime: string;
  endTime?: string | null;
  body?: string;
  location?: string;
  /** All-day uses ICS DATE semantics (wire end exclusive). */
  isAllDay?: boolean;
  /** Optional remind N days before start; null clears. */
  remindBeforeDays?: number | null;
  /** Analysis-task provenance; `""` / omit → null. `"__general__"` stripped client-side. */
  taskId?: string | null;
  /** Optional parent inventory item (item owns this calendar entry). */
  itemId?: string | null;
  /** Ownership workset; `""` / `"__general__"` / omit → builtin system workset (LIVE). */
  worksetId?: string | null;
  /** ``normal`` (default) | ``expires`` | ``purchase_effective``. */
  kind?: "normal" | "expires" | "purchase_effective";
  /** Optional transaction amount (purchase_effective); null clears. */
  amount?: number | null;
  /** expense | income; cleared when amount is null; server defaults expense. */
  direction?: "expense" | "income" | null;
  /** Per-row notify override. ``inherit`` | ``off``. */
  notifyPref?: "inherit" | "off";
}

export type ListUserEventsParams = {
  start?: string;
  end?: string;
  /** Analysis-task provenance id, or `""` for NULL provenance only. Not `__general__`. */
  taskId?: string;
  /** Ownership workset id (incl. builtin `__general__`). */
  worksetId?: string;
  /** Parent item id; `""` = stand-alone only. */
  itemId?: string;
  /** Substring on title / body / location. */
  search?: string;
  /** When set, server applies OFFSET/LIMIT paging. */
  limit?: number;
  offset?: number;
};

/** Strip fake `__general__` / blank provenance so it never hits the API as taskId. */
function normalizeWriteTaskId(taskId: string | null | undefined): string | null | undefined {
  if (taskId === undefined) return undefined;
  if (taskId === null) return null;
  const trimmed = taskId.trim();
  if (!trimmed || trimmed === SYSTEM_WORKSET_ID) return null;
  return trimmed;
}

function toListQuery(params?: ListUserEventsParams): Record<string, string> {
  const query: Record<string, string> = {};
  if (params?.start) query.start = params.start;
  if (params?.end) query.end = params.end;
  if (params?.taskId !== undefined) query.taskId = params.taskId;
  if (params?.worksetId !== undefined) query.worksetId = params.worksetId;
  if (params?.itemId !== undefined) query.itemId = params.itemId;
  if (params?.search) query.search = params.search;
  if (params?.limit !== undefined) query.limit = String(params.limit);
  if (params?.offset !== undefined) query.offset = String(params.offset);
  return query;
}

/** Paginated list (items / totalCount / hasMore). */
export function listUserEventsPage(params?: ListUserEventsParams): Promise<UserEventsPage> {
  return apiClient.get<UserEventsPage>("/api/v1/calendar/user-events", toListQuery(params));
}

export function createUserEvent(params: UserEventWriteParams): Promise<UserEvent> {
  const body: Record<string, unknown> = {
    title: params.title,
    startTime: params.startTime,
    endTime: params.endTime ?? null,
    body: params.body ?? "",
    location: params.location ?? "",
    isAllDay: Boolean(params.isAllDay),
    remindBeforeDays: params.remindBeforeDays ?? null,
  };
  if (params.itemId !== undefined) {
    body.itemId = params.itemId?.trim() || null;
  }
  const taskId = normalizeWriteTaskId(params.taskId);
  if (taskId !== undefined) body.taskId = taskId;
  if (params.worksetId !== undefined) body.worksetId = params.worksetId;
  if (params.kind !== undefined) body.kind = params.kind;
  if (params.amount !== undefined) body.amount = params.amount;
  if (params.direction !== undefined) body.direction = params.direction;
  if (params.notifyPref !== undefined) {
    body.notifyPref = normalizeNotifyPref(params.notifyPref);
  }
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
  if (params.remindBeforeDays !== undefined) {
    body.remindBeforeDays = params.remindBeforeDays;
  }
  if (params.itemId !== undefined) {
    body.itemId = params.itemId?.trim() || null;
  }
  if (params.taskId !== undefined) {
    body.taskId = normalizeWriteTaskId(params.taskId) ?? null;
  }
  if (params.worksetId !== undefined) body.worksetId = params.worksetId;
  if (params.kind !== undefined) body.kind = params.kind;
  if (params.amount !== undefined) body.amount = params.amount;
  if (params.direction !== undefined) body.direction = params.direction;
  if (params.notifyPref !== undefined) {
    body.notifyPref = normalizeNotifyPref(params.notifyPref);
  }
  return apiClient.patch<UserEvent>(`/api/v1/calendar/user-events/${id}`, body);
}

export function deleteUserEvent(id: string): Promise<void> {
  return apiClient.delete<void>(`/api/v1/calendar/user-events/${id}`);
}
