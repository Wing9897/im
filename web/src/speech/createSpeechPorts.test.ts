import { describe, expect, it, vi } from "vitest";

const isElectronDesktop = vi.hoisted(() => vi.fn(() => false));

vi.mock("../electron/electronWindow", () => ({
  isElectronDesktop: () => isElectronDesktop(),
}));

import { createSpeechPorts } from "./createSpeechPorts";

describe("createSpeechPorts", () => {
  it("returns browser adapters for browser providers", () => {
    isElectronDesktop.mockReturnValue(false);
    const ports = createSpeechPorts({
      sttProvider: "browser",
      ttsProvider: "browser",
    });
    expect(ports.stt.providerId).toBe("browser");
    expect(ports.tts.providerId).toBe("browser");
  });

  it("falls back to browser for reserved providers", () => {
    isElectronDesktop.mockReturnValue(false);
    const ports = createSpeechPorts({
      sttProvider: "whisper",
      ttsProvider: "doubao",
    });
    // Reserved ids are unimplemented — fallback is BrowserStt/BrowserTts, not a real adapter.
    expect(ports.stt.providerId).toBe("browser");
    expect(ports.tts.providerId).toBe("browser");
  });

  it("uses UnavailableStt on Electron so desktop never opens Web Speech", async () => {
    isElectronDesktop.mockReturnValue(true);
    const ports = createSpeechPorts({
      sttProvider: "browser",
      ttsProvider: "browser",
    });
    expect(ports.stt.isAvailable()).toBe(false);
    await expect(ports.stt.start()).resolves.toBeUndefined();
    await expect(ports.stt.stop()).resolves.toBeUndefined();
  });
});
