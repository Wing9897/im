import type { BadgeTone } from "../ui";
import type { AnalysisMode } from "../../types/common";

/** Shared badge tone for analysis-mode chips on task cards / detail. */
export const MODE_BADGE_TONE: Record<AnalysisMode, BadgeTone> = {
  leaderboard: "accent",
  event: "info",
  recurring: "success",
  calendar_task: "neutral",
  project: "warning",
};
