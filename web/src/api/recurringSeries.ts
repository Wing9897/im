/** REST client for standalone recurring calendar series. */

import { apiClient } from "./client";
import type {
  RecurringSeries,
  RecurringSeriesCreate,
  RecurringSeriesPage,
  RecurringSeriesPatch,
} from "../types/recurring";

export type ListRecurringSeriesParams = {
  worksetId?: string;
  itemId?: string;
  parentTaskId?: string;
  topLevelOnly?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
};

function toListQuery(params?: ListRecurringSeriesParams): Record<string, string> {
  const query: Record<string, string> = {};
  if (params?.worksetId !== undefined) query.worksetId = params.worksetId;
  if (params?.itemId !== undefined) query.itemId = params.itemId;
  if (params?.parentTaskId !== undefined) query.parentTaskId = params.parentTaskId;
  if (params?.topLevelOnly !== undefined) {
    query.topLevelOnly = String(params.topLevelOnly);
  }
  if (params?.search) query.search = params.search;
  if (params?.limit !== undefined) query.limit = String(params.limit);
  if (params?.offset !== undefined) query.offset = String(params.offset);
  return query;
}

export function listRecurringSeries(
  params?: ListRecurringSeriesParams,
): Promise<RecurringSeriesPage> {
  return apiClient.get<RecurringSeriesPage>(
    "/api/v1/calendar/recurring",
    toListQuery(params),
  );
}

export function createRecurringSeries(
  body: RecurringSeriesCreate,
): Promise<RecurringSeries> {
  return apiClient.post<RecurringSeries>("/api/v1/calendar/recurring", body);
}

export function getRecurringSeries(id: string): Promise<RecurringSeries> {
  return apiClient.get<RecurringSeries>(`/api/v1/calendar/recurring/${id}`);
}

export function patchRecurringSeries(
  id: string,
  body: RecurringSeriesPatch,
): Promise<RecurringSeries> {
  return apiClient.patch<RecurringSeries>(
    `/api/v1/calendar/recurring/${id}`,
    body,
  );
}

export function deleteRecurringSeries(id: string): Promise<void> {
  return apiClient.delete<void>(`/api/v1/calendar/recurring/${id}`);
}
