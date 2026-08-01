import type { TFunction } from "i18next";
import i18n from "../../i18n";

/**
 * Evidence-style options for analysisStrategyMode (LLM prompt guidance only).
 * Controls *which* intelligence items to emit and how strict the evidence bar is.
 * Location/time fill is fixed in the analyzer prompt (infer location; time only when present).
 */
export type EvidenceStyle = "conservative" | "balanced" | "aggressive";

type Translate = TFunction | typeof i18n.t;

const EVIDENCE_STYLE_VALUES: readonly EvidenceStyle[] = [
  "conservative",
  "balanced",
  "aggressive",
];

export function getEvidenceStyleOptions(
  t: Translate = i18n.t.bind(i18n),
): ReadonlyArray<{ value: EvidenceStyle; label: string; description: string }> {
  return EVIDENCE_STYLE_VALUES.map((value) => ({
    value,
    label: String(t(`settings:analysis.evidenceStyleOptions.${value}.label`)),
    description: String(t(`settings:analysis.evidenceStyleOptions.${value}.description`)),
  }));
}

export function normalizeEvidenceStyle(value: string | null | undefined): EvidenceStyle {
  if (value === "conservative" || value === "balanced" || value === "aggressive") {
    return value;
  }
  return "balanced";
}
