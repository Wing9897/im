/**
 * Worksets — optional ownership dimension for analysis tasks (CRUD).
 */

import { apiClient } from "./client";
import type { Workset } from "../types/worksets";

export type { Workset };

export function listWorksets(): Promise<Workset[]> {
  return apiClient.get<Workset[]>("/api/v1/worksets");
}

export function createWorkset(name: string): Promise<Workset> {
  return apiClient.post<Workset>("/api/v1/worksets", { name });
}

export function getWorkset(worksetId: string): Promise<Workset> {
  return apiClient.get<Workset>(`/api/v1/worksets/${encodeURIComponent(worksetId)}`);
}

export function renameWorkset(worksetId: string, name: string): Promise<Workset> {
  return apiClient.put<Workset>(`/api/v1/worksets/${encodeURIComponent(worksetId)}`, { name });
}

export function deleteWorkset(worksetId: string): Promise<{ ok: boolean }> {
  return apiClient.delete<{ ok: boolean }>(`/api/v1/worksets/${encodeURIComponent(worksetId)}`);
}
