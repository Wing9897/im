import type { LlmProfile } from "../../types/llmProfiles";
import { isMaskedSecret } from "../../types/llmProfiles";
import { normalizeLlmProvider } from "./llmProviderConfig";

/**
 * Mirror of server ``llm_profile_completeness``:
 * name + provider + model; ollama needs baseUrl; cloud providers need apiKey
 * (masked ``********`` counts as present).
 */
export function isLlmProfileComplete(profile: Pick<
  LlmProfile,
  "name" | "provider" | "model" | "baseUrl" | "apiKey"
>): boolean {
  if (!profile.name.trim()) return false;
  const provider = normalizeLlmProvider(String(profile.provider));
  if (!profile.model.trim()) return false;
  if (provider === "ollama") {
    return Boolean(profile.baseUrl.trim());
  }
  const key = profile.apiKey ?? "";
  return Boolean(key.trim()) || isMaskedSecret(key);
}

export function firstCompleteDefaultProfile(
  profiles: readonly LlmProfile[],
): LlmProfile | null {
  const complete = profiles.filter(isLlmProfileComplete);
  if (complete.length === 0) return null;
  return complete.find((p) => p.isDefault) ?? complete[0] ?? null;
}
