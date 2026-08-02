/**
 * Task-type identity mapped from analysis_mode (DB enum unchanged).
 * Recurring is a calendar task type (no AI avatar); other modes may show AI
 * staff avatars, but task-type labels use `tasks.employees.*.name` (not aiStaff titles).
 */
import type { AnalysisMode } from "../../types/common";
import type { AiStaffId } from "../aiStaff/aiStaff";

export type TaskEmployeeId =
  | "scheduleClerk"
  | "eventIntel"
  | "leaderboard"
  | "projectManager";

/** Picker / badge order: recurring first, then AI modes. */
export const TASK_EMPLOYEE_ORDER: readonly TaskEmployeeId[] = [
  "scheduleClerk",
  "eventIntel",
  "leaderboard",
  "projectManager",
] as const;

const MODE_BY_EMPLOYEE: Record<TaskEmployeeId, AnalysisMode> = {
  scheduleClerk: "recurring",
  eventIntel: "event",
  leaderboard: "leaderboard",
  projectManager: "project",
};

const EMPLOYEE_BY_MODE: Record<AnalysisMode, TaskEmployeeId> = {
  recurring: "scheduleClerk",
  event: "eventIntel",
  leaderboard: "leaderboard",
  project: "projectManager",
};

export function taskEmployeeForAnalysisMode(mode: AnalysisMode): TaskEmployeeId {
  return EMPLOYEE_BY_MODE[mode];
}

export function analysisModeForTaskEmployee(employeeId: TaskEmployeeId): AnalysisMode {
  return MODE_BY_EMPLOYEE[employeeId];
}

/** True when the task type uses AI staff (avatar + AI roster). */
export function taskEmployeeUsesAi(employeeId: TaskEmployeeId): boolean {
  return employeeId !== "scheduleClerk";
}

/** AI roster id when the type has an AiStaffAvatar; null for recurring. */
export function aiStaffIdForTaskEmployee(employeeId: TaskEmployeeId): AiStaffId | null {
  if (employeeId === "scheduleClerk") return null;
  return employeeId;
}
