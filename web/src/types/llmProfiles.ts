// ============================================================
// LLM profile / staff-instance wire types (OpenAPI-aligned)
// ============================================================

import type { components } from "../api/generated/schema";

type LlmProfileResponse = components["schemas"]["LlmProfileResponse"];
type LlmProfileUpsertBody = components["schemas"]["LlmProfileUpsertBody"];

/** Staff classes that can bind to an LLM profile (task-mode only). */
export type LlmStaffClass = NonNullable<LlmProfileUpsertBody["staffClasses"]>[number];

/** DDL staff classes (task-mode; assistant is a global slot, not a staff row). */
export const LLM_STAFF_CLASSES: readonly LlmStaffClass[] = [
  "leaderboard",
  "intel_event",
  "agent",
] as const;

/**
 * Task-mode classes shown as profile checkboxes.
 * Global trio (assistant / liaison / taskEditor) use singleton slots instead.
 */
export const LLM_TASK_STAFF_CLASSES: readonly LlmStaffClass[] = LLM_STAFF_CLASSES;

/** Singleton global slots on `/settings/ai/provider` (OpenAPI `LlmGlobalSlotBindingResponse.slot`). */
export type LlmGlobalSlotId = components["schemas"]["LlmGlobalSlotBindingResponse"]["slot"];

export const LLM_GLOBAL_SLOTS: readonly LlmGlobalSlotId[] = [
  "assistant",
  "liaison",
  "taskEditor",
] as const;

const STAFF_CLASS_SET = new Set<string>(LLM_STAFF_CLASSES);

/** Keep only known OpenAPI staff-class literals (API-boundary SoT). */
export function normalizeLlmStaffClasses(
  raw: readonly string[] | null | undefined,
): LlmStaffClass[] {
  if (!raw || raw.length === 0) return [];
  return LLM_STAFF_CLASSES.filter((c) => raw.includes(c));
}

/** Keep task-mode classes only. */
export function normalizeTaskStaffClasses(
  raw: readonly string[] | null | undefined,
): LlmStaffClass[] {
  return normalizeLlmStaffClasses(raw);
}

export function isLlmStaffClass(value: string): value is LlmStaffClass {
  return STAFF_CLASS_SET.has(value);
}

export type LlmWebSearchProvider = LlmProfileUpsertBody["webSearchProvider"];

/** Server-side vocabulary for `jsonMode` (CHECK: disabled / json_schema / json_object). */
export type LlmJsonMode = LlmProfileUpsertBody["jsonMode"];

/** Wire shape from GET /api/v1/llm/staff-instances. */
export type LlmStaffInstance = components["schemas"]["LlmStaffInstanceResponse"];

/**
 * Wire shape from GET /api/v1/llm/profiles.
 * OpenAPI marks list/timestamp fields optional (defaults); the server always
 * returns them — normalize at the API boundary so call sites see concrete types.
 */
export type LlmProfile = Omit<
  LlmProfileResponse,
  "staffClasses" | "staffInstances" | "createdAt" | "updatedAt"
> & {
  staffClasses: LlmStaffClass[];
  staffInstances: LlmStaffInstance[];
  createdAt: string | null;
  updatedAt: string | null;
};

/** Normalize a raw OpenAPI profile response at the HTTP boundary. */
export function normalizeLlmProfile(raw: LlmProfileResponse): LlmProfile {
  return {
    ...raw,
    staffClasses: normalizeLlmStaffClasses(raw.staffClasses),
    staffInstances: raw.staffInstances ?? [],
    createdAt: raw.createdAt ?? null,
    updatedAt: raw.updatedAt ?? null,
  };
}

/**
 * Body for POST /api/v1/llm/profiles and PATCH fields.
 * `jsonMode` stays draft-friendly (`string`) on the client; the editor select
 * only emits `LlmJsonMode` values and the server 422s anything else.
 */
export type LlmProfileUpsert = Omit<LlmProfileUpsertBody, "jsonMode"> & {
  jsonMode: LlmJsonMode | (string & {});
};

/**
 * Wire secret mask — same literal as `utils/configValidation` / `server.secrets`.
 * Kept local (not re-exported from configValidation) to avoid types↔utils cycles.
 */
export const MASKED_SECRET = "********";

export function isMaskedSecret(value: string | null | undefined): boolean {
  return value === MASKED_SECRET;
}
