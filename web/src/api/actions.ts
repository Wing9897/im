/**
 * REST API client functions for automation action management.
 */

import { apiClient } from "./client";
import type { components } from "./generated/schema";
import type { Action, ActionTriggerHistoryPage, TestActionResult } from "../types";

type ActionBody = components["schemas"]["ActionBody"];
type ActionToggleResponse = components["schemas"]["ActionToggleResponse"];

/** Creates a new automation action with the given configuration. */
export function createAction(params: ActionBody): Promise<Action> {
  return apiClient.post<Action>("/api/v1/actions", params);
}

/** Fetches all configured automation actions. */
export function listActions(): Promise<Action[]> {
  return apiClient.get<Action[]>("/api/v1/actions");
}

/** Updates an existing automation action's configuration. */
export function updateAction(
  id: string,
  params: ActionBody,
): Promise<Action> {
  return apiClient.put<Action>(`/api/v1/actions/${id}`, params);
}

/** Deletes an automation action by ID. */
export function deleteAction(id: string): Promise<void> {
  return apiClient.delete<void>(`/api/v1/actions/${id}`);
}

/** Enables or disables an automation action. */
export function toggleAction(id: string): Promise<ActionToggleResponse> {
  return apiClient.patch<ActionToggleResponse>(`/api/v1/actions/${id}/toggle`);
}

/** Fires a test execution of an automation action and returns the result. */
export function testAction(id: string): Promise<TestActionResult> {
  return apiClient.post<TestActionResult>(`/api/v1/actions/${id}/test`);
}

/** Fetches paginated action trigger history, optionally filtered by action. */
export function listActionTriggerHistory(params?: {
  actionId?: string;
  limit?: number;
  offset?: number;
}): Promise<ActionTriggerHistoryPage> {
  const queryParams: Record<string, string> = {};
  if (params?.actionId) queryParams.action_id = params.actionId;
  if (params?.limit !== undefined) queryParams.limit = String(params.limit);
  if (params?.offset !== undefined) queryParams.offset = String(params.offset);
  return apiClient.get<ActionTriggerHistoryPage>(
    "/api/v1/actions/trigger-history",
    queryParams,
  );
}
