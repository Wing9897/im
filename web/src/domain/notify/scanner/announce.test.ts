import { afterEach, describe, expect, it, vi } from "vitest";

import { announceVoiceReminder } from "./announce";
import type { TtsPort } from "../../../speech";

vi.mock("./preambleChime", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./preambleChime")>();
  return {
    ...actual,
    playVoiceReminderPreamble: vi.fn().mockResolvedValue(undefined),
  };
});

import { playVoiceReminderPreamble } from "./preambleChime";

describe("announceVoiceReminder", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("plays preamble before TTS speak", async () => {
    const order: string[] = [];
    vi.mocked(playVoiceReminderPreamble).mockImplementation(async () => {
      order.push("chime");
    });
    const tts: TtsPort = {
      providerId: "browser",
      isAvailable: () => true,
      cancel: () => {},
      speak: vi.fn(async () => {
        order.push("speak");
      }),
    };

    await announceVoiceReminder(tts, "測試朗讀", {
      lang: "zh-HK",
      preambleChimeId: "airport",
    });

    expect(playVoiceReminderPreamble).toHaveBeenCalledWith("airport");
    expect(tts.speak).toHaveBeenCalledWith("測試朗讀", { lang: "zh-HK" });
    expect(order).toEqual(["chime", "speak"]);
  });
});
