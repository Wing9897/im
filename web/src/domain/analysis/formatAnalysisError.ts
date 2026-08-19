import type { TFunction } from "i18next";

/**
 * Map stored batch / LLM error strings to user-facing copy.
 * Never surface Python KeyError repr such as ``'candidates'``.
 */
export function formatAnalysisErrorMessage(
  raw: string | null | undefined,
  t: TFunction,
): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (isGeminiNoCandidatesError(trimmed)) {
    return String(t("tasks:errors.geminiNoCandidates"));
  }

  return trimmed;
}

function isGeminiNoCandidatesError(message: string): boolean {
  if (message === "'candidates'" || message === '"candidates"') return true;
  if (/gemini response has no usable candidates/i.test(message)) return true;
  if (/gemini blocked the request/i.test(message)) return true;
  return false;
}
