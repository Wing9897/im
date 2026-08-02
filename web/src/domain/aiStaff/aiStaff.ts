/** Front-line vs back-office AI staff used in settings intro + chat chrome. */

import type { AnalysisMode } from "../../types/common";

export type AiStaffId =
  | "assistant"
  | "taskEditor"
  | "leaderboard"
  | "eventIntel"
  | "webIntel"
  | "projectManager";

/** Agent = multi-turn tool loop; oneshot = dedicated single-purpose LLM pass / form chat. */
export type AiStaffKind = "agent" | "oneshot";

export type AiStaffSurface = "frontline" | "backoffice";

export interface AiStaffDefinition {
  id: AiStaffId;
  kind: AiStaffKind;
  surface: AiStaffSurface;
  /** Accent hue for avatar ring (CSS color-mix friendly). */
  accent: string;
}

export const AI_STAFF_ROSTER: readonly AiStaffDefinition[] = [
  {
    id: "assistant",
    kind: "agent",
    surface: "frontline",
    accent: "oklch(0.72 0.12 220)",
  },
  {
    id: "taskEditor",
    kind: "oneshot",
    surface: "frontline",
    accent: "oklch(0.75 0.12 75)",
  },
  {
    id: "leaderboard",
    kind: "oneshot",
    surface: "backoffice",
    accent: "oklch(0.68 0.14 290)",
  },
  {
    id: "eventIntel",
    kind: "oneshot",
    surface: "backoffice",
    accent: "oklch(0.68 0.14 25)",
  },
  {
    id: "webIntel",
    kind: "oneshot",
    surface: "backoffice",
    accent: "oklch(0.70 0.12 200)",
  },
  {
    id: "projectManager",
    kind: "agent",
    surface: "backoffice",
    accent: "oklch(0.70 0.11 155)",
  },
] as const;

export function getAiStaff(id: AiStaffId): AiStaffDefinition {
  const found = AI_STAFF_ROSTER.find((s) => s.id === id);
  if (!found) throw new Error(`Unknown AI staff: ${id}`);
  return found;
}

/** Analysis task mode → back-office staff (calendar has no LLM staff). */
export function staffIdForAnalysisMode(mode: AnalysisMode): AiStaffId | null {
  if (mode === "leaderboard") return "leaderboard";
  if (mode === "event") return "eventIntel";
  if (mode === "web_intel") return "webIntel";
  if (mode === "project") return "projectManager";
  return null;
}
