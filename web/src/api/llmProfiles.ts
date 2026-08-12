/**
 * LLM profiles + staff instances — CRUD under /api/v1/llm.
 * Wire types live in `types/llmProfiles` (OpenAPI-aligned); this module is transport only.
 * ``staffClasses`` are normalized to ``LlmStaffClass[]`` once at the API boundary.
 */

import { apiClient } from "./client";
import type { components } from "./generated/schema";
import {
  normalizeLlmProfile,
  type LlmProfile,
  type LlmProfileUpsert,
  type LlmStaffInstance,
} from "../types/llmProfiles";

export type { LlmProfile, LlmProfileUpsert, LlmStaffInstance };

type LlmProfileResponse = components["schemas"]["LlmProfileResponse"];

async function getNormalizedProfile(path: string): Promise<LlmProfile> {
  const raw = await apiClient.get<LlmProfileResponse>(path);
  return normalizeLlmProfile(raw);
}

async function postNormalizedProfile(
  path: string,
  body: unknown,
): Promise<LlmProfile> {
  const raw = await apiClient.post<LlmProfileResponse>(path, body);
  return normalizeLlmProfile(raw);
}

async function patchNormalizedProfile(
  path: string,
  body: unknown,
): Promise<LlmProfile> {
  const raw = await apiClient.patch<LlmProfileResponse>(path, body);
  return normalizeLlmProfile(raw);
}

export async function listLlmProfiles(): Promise<LlmProfile[]> {
  const raw = await apiClient.get<LlmProfileResponse[]>("/api/v1/llm/profiles");
  return raw.map(normalizeLlmProfile);
}

export function createLlmProfile(body: LlmProfileUpsert): Promise<LlmProfile> {
  return postNormalizedProfile("/api/v1/llm/profiles", body);
}

export function getLlmProfile(profileId: string): Promise<LlmProfile> {
  return getNormalizedProfile(
    `/api/v1/llm/profiles/${encodeURIComponent(profileId)}`,
  );
}

export function patchLlmProfile(
  profileId: string,
  body: Partial<LlmProfileUpsert>,
): Promise<LlmProfile> {
  return patchNormalizedProfile(
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
  return postNormalizedProfile(
    `/api/v1/llm/profiles/${encodeURIComponent(profileId)}/copy`,
    name ? { name } : {},
  );
}

export function setDefaultLlmProfile(profileId: string): Promise<LlmProfile> {
  return postNormalizedProfile(
    `/api/v1/llm/profiles/${encodeURIComponent(profileId)}/set-default`,
    {},
  );
}

export function listLlmStaffInstances(): Promise<LlmStaffInstance[]> {
  return apiClient.get<LlmStaffInstance[]>("/api/v1/llm/staff-instances");
}
