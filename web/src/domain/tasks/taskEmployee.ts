/**
 * Task-type identity aligned 1:1 with analysis_mode enum token.
 * Task-type labels use `tasks.employees.*.name` (not AI staff titles).
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
  intel_event: "intel_event",
  leaderboard: "leaderboard",
  agent: "agent",
};

const EMPLOYEE_BY_MODE: Record<AnalysisMode, TaskEmployeeId> = {
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
export function taskEmployeeUsesAi(_employeeId: TaskEmployeeId): boolean {
  return true;
}

/** AI roster id for a task type. */
export function aiStaffIdForTaskEmployee(employeeId: TaskEmployeeId): AiStaffId {
  return employeeId;
}
