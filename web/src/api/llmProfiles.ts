/**
 * LLM profiles + staff instances — Stamp 29 CRUD under /api/v1/llm.
 */

import { apiClient } from "./client";
import type {
  LlmProfile,
  LlmProfileUpsert,
  LlmStaffInstance,
} from "../types/llmProfiles";

export type { LlmProfile, LlmProfileUpsert, LlmStaffInstance };

export function listLlmProfiles(): Promise<LlmProfile[]> {
  return apiClient.get<LlmProfile[]>("/api/v1/llm/profiles");
}

export function createLlmProfile(body: LlmProfileUpsert): Promise<LlmProfile> {
  return apiClient.post<LlmProfile>("/api/v1/llm/profiles", body);
}

export function getLlmProfile(profileId: string): Promise<LlmProfile> {
  return apiClient.get<LlmProfile>(
    `/api/v1/llm/profiles/${encodeURIComponent(profileId)}`,
  );
}

export function patchLlmProfile(
  profileId: string,
  body: Partial<LlmProfileUpsert>,
): Promise<LlmProfile> {
  return apiClient.patch<LlmProfile>(
    `/api/v1/llm/profiles/${encodeURIComponent(profileId)}`,
    body,
  );
}

export function deleteLlmProfile(profileId: string): Promise<{ ok: boolean }> {
  return apiClient.delete<{ ok: boolean }>(
    `/api/v1/llm/profiles/${encodeURIComponent(profileId)}`,
  );
}

export function copyLlmProfile(
  profileId: string,
  name?: string,
): Promise<LlmProfile> {
  return apiClient.post<LlmProfile>(
    `/api/v1/llm/profiles/${encodeURIComponent(profileId)}/copy`,
    name ? { name } : {},
  );
}

export function setDefaultLlmProfile(profileId: string): Promise<LlmProfile> {
  return apiClient.post<LlmProfile>(
    `/api/v1/llm/profiles/${encodeURIComponent(profileId)}/set-default`,
    {},
  );
}

export function listLlmStaffInstances(): Promise<LlmStaffInstance[]> {
  return apiClient.get<LlmStaffInstance[]>("/api/v1/llm/staff-instances");
}
