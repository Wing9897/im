import { describe, expect, it, beforeEach } from "vitest";
import i18n from "../../i18n";
import { ensureZhHantLocale } from "../../test/i18nHarness";
import { formatAnalysisErrorMessage } from "./formatAnalysisError";

describe("formatAnalysisErrorMessage", () => {
  beforeEach(async () => {
    await ensureZhHantLocale();
  });

  it("maps Python KeyError('candidates') repr to zh-Hant copy", () => {
    const shown = formatAnalysisErrorMessage("'candidates'", i18n.t.bind(i18n));
    expect(shown).toBe(String(i18n.t("tasks:errors.geminiNoCandidates")));
    expect(shown).not.toContain("candidates");
  });

  it("maps server LlmClientError no-candidates message", () => {
    const shown = formatAnalysisErrorMessage(
      "Gemini response has no usable candidates (SAFETY)",
      i18n.t.bind(i18n),
    );
    expect(shown).toBe(String(i18n.t("tasks:errors.geminiNoCandidates")));
  });

  it("maps MAX_TOKENS truncation to a distinct zh-Hant copy", () => {
    const shown = formatAnalysisErrorMessage(
      "Gemini response was truncated (MAX_TOKENS). Increase max output tokens or shorten the prompt.",
      i18n.t.bind(i18n),
    );
    expect(shown).toBe(String(i18n.t("tasks:errors.geminiMaxTokens")));
    expect(shown).not.toMatch(/MAX_TOKENS/);
  });

  it("maps legacy no-candidates MAX_TOKENS batches to the truncation copy", () => {
    const shown = formatAnalysisErrorMessage(
      "Gemini response has no usable candidates (MAX_TOKENS)",
      i18n.t.bind(i18n),
    );
    expect(shown).toBe(String(i18n.t("tasks:errors.geminiMaxTokens")));
  });

  it("maps Gemini blocked responses", () => {
    const shown = formatAnalysisErrorMessage(
      "Gemini blocked the request (SAFETY)",
      i18n.t.bind(i18n),
    );
    expect(shown).toBe(String(i18n.t("tasks:errors.geminiNoCandidates")));
  });

  it("passes through unrelated errors", () => {
    expect(formatAnalysisErrorMessage("rate limited", i18n.t.bind(i18n))).toBe("rate limited");
  });

  it("returns null for empty input", () => {
    expect(formatAnalysisErrorMessage(null, i18n.t.bind(i18n))).toBeNull();
    expect(formatAnalysisErrorMessage("   ", i18n.t.bind(i18n))).toBeNull();
  });
});
