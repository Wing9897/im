import { describe, expect, it } from "vitest";
import { resolveVoiceReleaseText, takeHeardTextForSend } from "./voiceReleaseSend";

describe("voiceReleaseSend", () => {
  it("takeHeardTextForSend trims and rejects empty", () => {
    expect(takeHeardTextForSend("  hi  ")).toBe("hi");
    expect(takeHeardTextForSend("   ")).toBeNull();
  });

  it("prefers heard after stop, then before, then draft only with STT flag", () => {
    expect(
      resolveVoiceReleaseText({
        heardAfterStop: " after ",
        heardBeforeStop: "before",
        draftBeforeStop: "draft",
        hadSttTranscript: true,
      }),
    ).toBe("after");

    expect(
      resolveVoiceReleaseText({
        heardAfterStop: "",
        heardBeforeStop: " before ",
        draftBeforeStop: "draft",
        hadSttTranscript: true,
      }),
    ).toBe("before");

    expect(
      resolveVoiceReleaseText({
        heardAfterStop: "",
        heardBeforeStop: "",
        draftBeforeStop: "  stuck stt in draft  ",
        hadSttTranscript: true,
      }),
    ).toBe("stuck stt in draft");
  });

  it("does not send typed draft when STT never produced text", () => {
    expect(
      resolveVoiceReleaseText({
        heardAfterStop: "",
        heardBeforeStop: "",
        draftBeforeStop: "typed only",
        hadSttTranscript: false,
      }),
    ).toBeNull();
  });
});
