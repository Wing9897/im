/**
 * Worksets — optional ownership dimension for analysis tasks (CRUD).
 */

import { apiClient } from "./client";
import type { Workset } from "../types/worksets";

export type { Workset };

export function listWorksets(): Promise<Workset[]> {
  return apiClient.get<Workset[]>("/api/v1/worksets");
}

export function createWorkset(
  name: string,
  opts?: {
    notifyEnabled?: boolean;
    externalEnabled?: boolean;
    description?: string;
    cover?: string;
  },
): Promise<Workset> {
  return apiClient.post<Workset>("/api/v1/worksets", {
    name,
    ...(opts?.notifyEnabled === undefined ? {} : { notifyEnabled: opts.notifyEnabled }),
    ...(opts?.externalEnabled === undefined ? {} : { externalEnabled: opts.externalEnabled }),
    ...(opts?.description === undefined ? {} : { description: opts.description }),
    ...(opts?.cover === undefined ? {} : { cover: opts.cover }),
  });
}

export function getWorkset(worksetId: string): Promise<Workset> {
  return apiClient.get<Workset>(`/api/v1/worksets/${encodeURIComponent(worksetId)}`);
}

export function updateWorkset(
  worksetId: string,
  body: {
    name?: string;
    notifyEnabled?: boolean;
    externalEnabled?: boolean;
    description?: string;
    cover?: string;
  },
): Promise<Workset> {
  return apiClient.put<Workset>(`/api/v1/worksets/${encodeURIComponent(worksetId)}`, body);
}

export function renameWorkset(worksetId: string, name: string): Promise<Workset> {
  return updateWorkset(worksetId, { name });
}

export function deleteWorkset(worksetId: string): Promise<{ ok: boolean }> {
  return apiClient.delete<{ ok: boolean }>(`/api/v1/worksets/${encodeURIComponent(worksetId)}`);
}
