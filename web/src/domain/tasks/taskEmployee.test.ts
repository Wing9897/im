import { describe, expect, it } from "vitest";
import {
  TASK_EMPLOYEE_ORDER,
  analysisModeForTaskEmployee,
  aiStaffIdForTaskEmployee,
  taskEmployeeForAnalysisMode,
  taskEmployeeUsesAi,
} from "./taskEmployee";
import { ANALYSIS_MODE_ORDER } from "./analysisModeCapabilities";

describe("taskEmployee", () => {
  it("maps every analysis mode to an employee and back", () => {
    for (const mode of ANALYSIS_MODE_ORDER) {
      const employeeId = taskEmployeeForAnalysisMode(mode);
      expect(analysisModeForTaskEmployee(employeeId)).toBe(mode);
    }
  });

  it("covers all task types in picker order", () => {
    expect(TASK_EMPLOYEE_ORDER).toEqual([
      "scheduleClerk",
      "eventIntel",
      "leaderboard",
      "projectManager",
    ]);
  });

  it("maps AI task types to AiStaff ids and recurring to null", () => {
    expect(aiStaffIdForTaskEmployee("scheduleClerk")).toBeNull();
    expect(aiStaffIdForTaskEmployee("eventIntel")).toBe("eventIntel");
    expect(aiStaffIdForTaskEmployee("leaderboard")).toBe("leaderboard");
    expect(aiStaffIdForTaskEmployee("projectManager")).toBe("projectManager");
  });

  it("marks only non-recurring types as AI", () => {
    expect(taskEmployeeUsesAi("scheduleClerk")).toBe(false);
    expect(taskEmployeeUsesAi("eventIntel")).toBe(true);
    expect(taskEmployeeUsesAi("leaderboard")).toBe(true);
    expect(taskEmployeeUsesAi("projectManager")).toBe(true);
  });
});
