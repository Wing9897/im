/**
 * Which analysis modes expose the task template preset catalog.
 * Schedule-only buckets (non-schedulable) have no prompt templates.
 */

import type { AnalysisMode } from "../../types";
import { analysisModeSupportsTaskPresets as supportsPresets } from "./analysisModeCapabilities";

/** Modes that appear as preset filter chips / can own builtin templates. */
export function analysisModeSupportsTaskPresets(mode: AnalysisMode): boolean {
  return supportsPresets(mode);
}
