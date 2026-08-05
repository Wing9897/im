import { beforeEach, describe, expect, it, vi } from "vitest";

const isElectronDesktop = vi.hoisted(() => vi.fn(() => false));

vi.mock("../electron/electronWindow", () => ({
  isElectronDesktop: () => isElectronDesktop(),
}));

vi.mock("../api/uiPrefs", () => ({
  fetchAssistantVoiceIo: vi.fn(async () => ({
    configured: false,
    settings: null,
  })),
  putAssistantVoiceIo: vi.fn(async (settings: unknown) => ({
    configured: true,
    settings,
  })),
}));

import {
  DEFAULT_VOICE_SETTINGS,
  getSttProviderOptions,
  getTtsProviderOptions,
  loadVoiceSettings,
  normalizeVoiceSettings,
  resetVoiceSettingsCacheForTests,
  saveVoiceSettings,
} from "./voiceSettings";

describe("voiceSettings", () => {
  beforeEach(() => {
    resetVoiceSettingsCacheForTests();
    isElectronDesktop.mockReturnValue(false);
  });

  it("marks browser STT unavailable on Electron desktop", () => {
    isElectronDesktop.mockReturnValue(true);
    const browser = getSttProviderOptions().find((o) => o.id === "browser");
    expect(browser?.available).toBe(false);
  });

  it("exposes only the implemented browser STT/TTS providers", () => {
    const sttIds = getSttProviderOptions().map((o) => o.id);
    expect(sttIds).toEqual(["browser"]);

    const ttsIds = getTtsProviderOptions().map((o) => o.id);
    expect(ttsIds).toEqual(["browser"]);
  });

  it("returns defaults before hydration", () => {
    expect(loadVoiceSettings()).toEqual(DEFAULT_VOICE_SETTINGS);
  });

  it("persists and reloads browser providers + ttsEnabled", () => {
    saveVoiceSettings({
      sttProvider: "browser",
      ttsProvider: "browser",
      ttsEnabled: false,
      speechLanguage: "zh-CN",
      spacePttMode: "toggle",
      ttsVoiceUri: "tracy-uri",
      defaultWorksetId: "task-ct-1",
    });
    expect(loadVoiceSettings()).toMatchObject({
      sttProvider: "browser",
      ttsProvider: "browser",
      ttsEnabled: false,
      speechLanguage: "zh-CN",
      spacePttMode: "toggle",
      ttsVoiceUri: "tracy-uri",
      defaultWorksetId: "task-ct-1",
    });
  });

  it("normalizes empty defaultWorksetId to __user__", () => {
    expect(
      normalizeVoiceSettings({
        defaultWorksetId: "",
      } as never).defaultWorksetId,
    ).toBe("__user__");
    expect(DEFAULT_VOICE_SETTINGS.defaultWorksetId).toBe("__user__");
  });

  it("falls back to defaults for unknown / legacy reserved provider ids", () => {
    expect(
      normalizeVoiceSettings({
        sttProvider: "whisper",
        ttsProvider: "doubao",
        ttsEnabled: true,
      } as never),
    ).toMatchObject({
      sttProvider: "browser",
      ttsProvider: "browser",
    });
    expect(
      normalizeVoiceSettings({
        sttProvider: "not-real",
        ttsProvider: "also-fake",
        ttsEnabled: true,
      } as never),
    ).toMatchObject({
      sttProvider: "browser",
      ttsProvider: "browser",
    });
  });
});
