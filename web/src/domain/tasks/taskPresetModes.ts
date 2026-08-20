/**
 * Which analysis modes expose the task template preset catalog.
 * Schedule-only buckets (non-schedulable) have no prompt templates.
 */

import type { AnalysisMode } from "../../types";
import { analysisModeSupportsTaskPresets as supportsPresets } from "./analysisModeCapabilities";

export type TaskPresetModeFilter = AnalysisMode | "all";

/** Modes that appear as preset filter chips / can own builtin templates. */
export function analysisModeSupportsTaskPresets(mode: AnalysisMode): boolean {
  return supportsPresets(mode);
}

/** Picker chip filter: `all` or a single analysis mode that owns templates. */
export function filterTaskTemplatePresetsByMode<T extends { analysisMode: AnalysisMode }>(
  presets: readonly T[],
  filter: TaskPresetModeFilter,
): T[] {
  return presets.filter((preset) => {
    if (!analysisModeSupportsTaskPresets(preset.analysisMode)) {
      return false;
    }
    return filter === "all" || preset.analysisMode === filter;
  });
}
