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
      "recurring",
      "intel_event",
      "web_intel",
      "leaderboard",
      "project",
    ]);
  });

  it("maps AI task types to AiStaff ids and recurring to null", () => {
    expect(aiStaffIdForTaskEmployee("recurring")).toBeNull();
    expect(aiStaffIdForTaskEmployee("intel_event")).toBe("intel_event");
    expect(aiStaffIdForTaskEmployee("web_intel")).toBe("web_intel");
    expect(aiStaffIdForTaskEmployee("leaderboard")).toBe("leaderboard");
    expect(aiStaffIdForTaskEmployee("project")).toBe("project");
  });

  it("marks only non-recurring types as AI", () => {
    expect(taskEmployeeUsesAi("recurring")).toBe(false);
    expect(taskEmployeeUsesAi("intel_event")).toBe(true);
    expect(taskEmployeeUsesAi("web_intel")).toBe(true);
    expect(taskEmployeeUsesAi("leaderboard")).toBe(true);
    expect(taskEmployeeUsesAi("project")).toBe(true);
  });
});
