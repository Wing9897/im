import type { LlmProvider } from "./common";

/** Staff classes that can bind to an LLM profile. */
export type LlmStaffClass = "leaderboard" | "intel_event" | "agent" | "assistant";

export const LLM_STAFF_CLASSES: readonly LlmStaffClass[] = [
  "leaderboard",
  "intel_event",
  "agent",
  "assistant",
] as const;

export type LlmWebSearchProvider = "auto" | "duckduckgo" | "brave";

/** Wire shape from GET /api/v1/llm/staff-instances. */
export type LlmStaffInstance = {
  id: string;
  staffClass: LlmStaffClass | string;
  profileId: string;
  displayName: string | null;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  profileName?: string | null;
  profileProvider?: string | null;
  profileModel?: string | null;
  profileIsDefault?: boolean | null;
};

/** Wire shape from GET /api/v1/llm/profiles. */
export type LlmProfile = {
  id: string;
  name: string;
  provider: LlmProvider | string;
  baseUrl: string;
  model: string;
  apiKey: string;
  thinkingEnabled: boolean;
  jsonMode: string;
  webSearchEnabled: boolean;
  webSearchProvider: string;
  braveSearchApiKey: string;
  isDefault: boolean;
  staffClasses: string[];
  staffInstances: LlmStaffInstance[];
  createdAt: string | null;
  updatedAt: string | null;
};

/** Body for POST /api/v1/llm/profiles and PATCH fields. */
export type LlmProfileUpsert = {
  name: string;
  provider: LlmProvider;
  baseUrl?: string;
  model?: string;
  /** Omit or send masked ``********`` to keep the stored key. */
  apiKey?: string | null;
  thinkingEnabled?: boolean;
  jsonMode?: string;
  webSearchEnabled?: boolean;
  webSearchProvider?: LlmWebSearchProvider;
  braveSearchApiKey?: string | null;
  staffClasses?: LlmStaffClass[];
  isDefault?: boolean | null;
};

export const MASKED_SECRET = "********";

export function isMaskedSecret(value: string | null | undefined): boolean {
  return value === MASKED_SECRET;
}
