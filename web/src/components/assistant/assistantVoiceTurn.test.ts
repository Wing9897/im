import { describe, expect, it } from "vitest";
import { latestAssistantId, shouldKeepVoiceTurn } from "./assistantVoiceTurn";

describe("shouldKeepVoiceTurn", () => {
  const idle = {
    listening: false,
    holdArmed: false,
    sending: false,
    sendStartedThisTurn: false,
    assistantIdWhenArmed: null as string | null,
    latestAssistantId: null as string | null,
  };

  it("stays latched through the listen-to-send gap", () => {
    expect(shouldKeepVoiceTurn({ ...idle, listening: true })).toBe(true);
    expect(shouldKeepVoiceTurn(idle)).toBe(true);
    expect(shouldKeepVoiceTurn({ ...idle, sending: true })).toBe(true);
  });

  it("clears after this turn's assistant id lands", () => {
    expect(
      shouldKeepVoiceTurn({
        ...idle,
        sendStartedThisTurn: true,
        assistantIdWhenArmed: "a0",
        latestAssistantId: "a1",
      }),
    ).toBe(false);
  });

  it("clears on send rollback when no new assistant arrived", () => {
    expect(
      shouldKeepVoiceTurn({
        ...idle,
        sendStartedThisTurn: true,
        assistantIdWhenArmed: "a0",
        latestAssistantId: "a0",
      }),
    ).toBe(false);
  });
});

describe("latestAssistantId", () => {
  it("returns the newest assistant id", () => {
    expect(
      latestAssistantId([
        { id: "u1", role: "user" },
        { id: "a1", role: "assistant" },
        { id: "u2", role: "user" },
        { id: "a2", role: "assistant" },
      ]),
    ).toBe("a2");
  });
});
