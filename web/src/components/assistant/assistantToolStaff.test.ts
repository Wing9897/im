import { describe, expect, it } from "vitest";
import { staffIdForAgentTool } from "./assistantToolStaff";

describe("staffIdForAgentTool", () => {
  it("maps tasks.consult_advisor to taskEditor", () => {
    expect(staffIdForAgentTool("tasks.consult_advisor")).toBe("taskEditor");
  });

  it("returns null for other tools", () => {
    expect(staffIdForAgentTool("calendar.upcoming")).toBeNull();
    expect(staffIdForAgentTool("web.search")).toBeNull();
  });
});
