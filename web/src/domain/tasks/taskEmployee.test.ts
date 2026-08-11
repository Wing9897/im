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

  it("covers Tasks picker order without recurring (schedule owns recurring)", () => {
    expect(TASK_EMPLOYEE_ORDER).toEqual([
      "intel_event",
      "leaderboard",
      "agent",
    ]);
    expect(TASK_EMPLOYEE_ORDER).not.toContain("recurring");
  });

  it("maps task types to AiStaff ids", () => {
    expect(aiStaffIdForTaskEmployee("intel_event")).toBe("intel_event");
    expect(aiStaffIdForTaskEmployee("agent")).toBe("agent");
    expect(aiStaffIdForTaskEmployee("leaderboard")).toBe("leaderboard");
  });

  it("marks all analysis task types as AI", () => {
    expect(taskEmployeeUsesAi("intel_event")).toBe(true);
    expect(taskEmployeeUsesAi("agent")).toBe(true);
    expect(taskEmployeeUsesAi("leaderboard")).toBe(true);
  });
});
