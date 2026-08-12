/** Front-line vs back-office AI staff used in settings intro + chat chrome. */

export type AiStaffId =
  | "assistant"
  | "taskEditor"
  | "leaderboard"
  | "intel_event"
  | "agent";

/** Agent = multi-turn tool loop; oneshot = dedicated single-purpose LLM pass / form chat. */
export type AiStaffKind = "agent" | "oneshot";

export type AiStaffSurface = "frontline" | "backoffice";

export interface AiStaffDefinition {
  id: AiStaffId;
  kind: AiStaffKind;
  surface: AiStaffSurface;
}

export const AI_STAFF_ROSTER: readonly AiStaffDefinition[] = [
  {
    id: "assistant",
    kind: "agent",
    surface: "frontline",
  },
  {
    id: "taskEditor",
    kind: "oneshot",
    surface: "frontline",
  },
  {
    id: "leaderboard",
    kind: "oneshot",
    surface: "backoffice",
  },
  {
    id: "intel_event",
    kind: "oneshot",
    surface: "backoffice",
  },
  {
    id: "agent",
    kind: "agent",
    surface: "backoffice",
  },
] as const;

export function getAiStaff(id: AiStaffId): AiStaffDefinition {
  const found = AI_STAFF_ROSTER.find((s) => s.id === id);
  if (!found) throw new Error(`Unknown AI staff: ${id}`);
  return found;
}
