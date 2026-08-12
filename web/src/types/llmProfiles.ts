// ============================================================
// LLM profile / staff-instance wire types (OpenAPI-aligned)
// ============================================================

import type { components } from "../api/generated/schema";

type LlmProfileResponse = components["schemas"]["LlmProfileResponse"];
type LlmProfileUpsertBody = components["schemas"]["LlmProfileUpsertBody"];

/** Staff classes that can bind to an LLM profile. */
export type LlmStaffClass = NonNullable<LlmProfileUpsertBody["staffClasses"]>[number];

export const LLM_STAFF_CLASSES: readonly LlmStaffClass[] = [
  "leaderboard",
  "intel_event",
  "agent",
  "assistant",
] as const;

const STAFF_CLASS_SET = new Set<string>(LLM_STAFF_CLASSES);

/** Keep only known OpenAPI staff-class literals (API-boundary SoT). */
export function normalizeLlmStaffClasses(
  raw: readonly string[] | null | undefined,
): LlmStaffClass[] {
  if (!raw || raw.length === 0) return [];
  return LLM_STAFF_CLASSES.filter((c) => raw.includes(c));
}

export function isLlmStaffClass(value: string): value is LlmStaffClass {
  return STAFF_CLASS_SET.has(value);
}

export type LlmWebSearchProvider = LlmProfileUpsertBody["webSearchProvider"];

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

/** Body for POST /api/v1/llm/profiles and PATCH fields. */
export type LlmProfileUpsert = LlmProfileUpsertBody;

/**
 * Wire secret mask — same literal as `utils/configValidation` / `server.secrets`.
 * Kept local (not re-exported from configValidation) to avoid types↔utils cycles.
 */
export const MASKED_SECRET = "********";

export function isMaskedSecret(value: string | null | undefined): boolean {
  return value === MASKED_SECRET;
}
