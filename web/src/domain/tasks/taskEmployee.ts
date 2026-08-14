/**
 * Task-type identity aligned 1:1 with analysis_mode enum token.
 * Task-type labels use `tasks:employees.*.name` (not AI staff titles).
 *
 * `TaskEmployeeId` is an intentional display alias of `AnalysisMode` — keep the
 * named helpers so call sites stay stable if the two ever diverge.
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

export function taskEmployeeForAnalysisMode(mode: AnalysisMode): TaskEmployeeId {
  return mode;
}

export function analysisModeForTaskEmployee(employeeId: TaskEmployeeId): AnalysisMode {
  return employeeId;
}

/** AI roster id for a task type. */
export function aiStaffIdForTaskEmployee(employeeId: TaskEmployeeId): AiStaffId {
  return employeeId;
}
