/**
 * LLM profiles + global slots — transport under /api/v1/llm.
 * Wire types live in `types/llmProfiles` (OpenAPI-aligned).
 * ``staffClasses`` are normalized to ``LlmStaffClass[]`` once at the API boundary.
 */

import { apiClient } from "./client";
import type { components } from "./generated/schema";
import {
  normalizeLlmProfile,
  type LlmGlobalSlotId,
  type LlmProfile,
  type LlmProfileUpsert,
  type LlmStaffInstance,
} from "../types/llmProfiles";

export type { LlmProfile, LlmProfileUpsert, LlmStaffInstance, LlmGlobalSlotId };

export type LlmGlobalSlotBinding = {
  slot: LlmGlobalSlotId;
  profileId: string | null;
  profileName: string | null;
  profileProvider: string | null;
  profileModel: string | null;
};

type LlmProfileResponse = components["schemas"]["LlmProfileResponse"];

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

export async function listLlmGlobalSlots(): Promise<LlmGlobalSlotBinding[]> {
  const raw = await apiClient.get<{ slots: LlmGlobalSlotBinding[] }>(
    "/api/v1/llm/global-slots",
  );
  return raw.slots ?? [];
}

export function bindLlmGlobalSlot(
  slot: LlmGlobalSlotId,
  profileId: string | null,
): Promise<LlmGlobalSlotBinding> {
  return apiClient.put<LlmGlobalSlotBinding>(
    `/api/v1/llm/global-slots/${encodeURIComponent(slot)}`,
    { profileId },
  );
}
