/**
 * L2 task employees — identity mapped from analysis_mode (DB enum unchanged).
 * Recurring has a schedule clerk (no AI); other modes map to AI staff logos.
 */
import type { AnalysisMode } from "../../types/common";
import type { AiStaffId } from "../aiStaff/aiStaff";

export type TaskEmployeeId =
  | "scheduleClerk"
  | "eventIntel"
  | "leaderboard"
  | "projectManager";

export type TaskEmployeeGroupId = "noAi" | "ai";

export const TASK_EMPLOYEE_ORDER: readonly TaskEmployeeId[] = [
  "scheduleClerk",
  "eventIntel",
  "leaderboard",
  "projectManager",
] as const;

export const TASK_EMPLOYEE_GROUPS: ReadonlyArray<{
  id: TaskEmployeeGroupId;
  employees: readonly TaskEmployeeId[];
}> = [
  { id: "noAi", employees: ["scheduleClerk"] },
  { id: "ai", employees: ["eventIntel", "leaderboard", "projectManager"] },
];

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

/** AI roster id when the employee has an AiStaffAvatar; null for schedule clerk. */
export function aiStaffIdForTaskEmployee(employeeId: TaskEmployeeId): AiStaffId | null {
  if (employeeId === "scheduleClerk") return null;
  return employeeId;
}
