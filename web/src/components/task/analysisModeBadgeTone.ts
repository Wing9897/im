import type { BadgeTone } from "../ui";
import type { AnalysisMode } from "../../types/common";

/** Shared badge tone for analysis-mode chips on task cards / detail. */
export const MODE_BADGE_TONE: Record<AnalysisMode, BadgeTone> = {
  leaderboard: "accent",
  intel_event: "info",
  recurring: "success",
  agent: "warning",
};

/** Left AccentBar class for analysis-mode entity cards (TaskCard / workset detail). */
export const MODE_ACCENT_CLASS: Record<AnalysisMode, string> = {
  leaderboard: "bg-accent",
  intel_event: "bg-info",
  recurring: "bg-success",
  agent: "bg-warning",
};
