/**
 * Task-type identity aligned 1:1 with analysis_mode enum token.
 * `recurring` is a calendar task type (no AI avatar); other modes may show AI
 * staff avatars, but task-type labels use `tasks.employees.*.name` (not aiStaff titles).
 *
 * `TaskEmployeeId` is now a direct alias of `AnalysisMode` — the mapping functions
 * are kept as an abstraction boundary so call sites stay stable if the two diverge.
 */
import type { AnalysisMode } from "../../types/common";
import type { AiStaffId } from "../aiStaff/aiStaff";

export type TaskEmployeeId = AnalysisMode;

/** Picker / badge order for Tasks create/filter (recurring lives under /schedule). */
export const TASK_EMPLOYEE_ORDER: readonly TaskEmployeeId[] = [
  "intel_event",
  "leaderboard",
  "agent",
] as const;

const MODE_BY_EMPLOYEE: Record<TaskEmployeeId, AnalysisMode> = {
  recurring: "recurring",
  intel_event: "intel_event",
  leaderboard: "leaderboard",
  agent: "agent",
};

const EMPLOYEE_BY_MODE: Record<AnalysisMode, TaskEmployeeId> = {
  recurring: "recurring",
  intel_event: "intel_event",
  leaderboard: "leaderboard",
  agent: "agent",
};

export function taskEmployeeForAnalysisMode(mode: AnalysisMode): TaskEmployeeId {
  return EMPLOYEE_BY_MODE[mode];
}

export function analysisModeForTaskEmployee(employeeId: TaskEmployeeId): AnalysisMode {
  return MODE_BY_EMPLOYEE[employeeId];
}

/** True when the task type uses AI staff (avatar + AI roster). */
export function taskEmployeeUsesAi(employeeId: TaskEmployeeId): boolean {
  return employeeId !== "recurring";
}

/** AI roster id when the type has an AiStaffAvatar; null for recurring. */
export function aiStaffIdForTaskEmployee(employeeId: TaskEmployeeId): AiStaffId | null {
  if (employeeId === "recurring") return null;
  return employeeId;
}
