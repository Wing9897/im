import { describe, expect, it } from "vitest";
import { normalizeAgentPolicy } from "./agentTaskPolicy";

describe("normalizeAgentPolicy", () => {
  it("strips outputAnalysisEvents when trigger is message_cursor", () => {
    const policy = normalizeAgentPolicy(
      {
        triggerMode: "message_cursor",
        outputCalendar: true,
        outputAnalysisEvents: true,
      },
      { hasChannels: true },
    );
    expect(policy.triggerMode).toBe("message_cursor");
    expect(policy.outputAnalysisEvents).toBe(false);
    expect(policy.outputCalendar).toBe(true);
  });

  it("forces calendar output when cursor combo would leave no output", () => {
    const policy = normalizeAgentPolicy(
      {
        triggerMode: "message_cursor",
        outputCalendar: false,
        outputAnalysisEvents: true,
      },
      { hasChannels: true },
    );
    expect(policy.outputAnalysisEvents).toBe(false);
    expect(policy.outputCalendar).toBe(true);
    expect(policy.capCalendarWrites).toBe(true);
  });

  it("allows schedule + outputAnalysisEvents", () => {
    const policy = normalizeAgentPolicy({
      triggerMode: "schedule",
      outputCalendar: false,
      outputAnalysisEvents: true,
    });
    expect(policy.outputAnalysisEvents).toBe(true);
    expect(policy.outputCalendar).toBe(false);
  });
});
