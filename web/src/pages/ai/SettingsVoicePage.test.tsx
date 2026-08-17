import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestHarness, type TestHarness } from "../../test/render-helpers";
import i18n from "../../i18n";

vi.mock("../../context/ToastContext", async () =>
  (await import("../../test/context-mocks")).toastContextModuleMock());
vi.mock("../../context/TaskCatalogContext", async () =>
  (await import("../../test/context-mocks")).taskCatalogModuleMock());
vi.mock("../../speech/useBrowserTtsVoiceOptions", () => ({
  useBrowserTtsVoiceOptions: () => [],
}));
vi.mock("../../domain/assistant/directModeSupport", () => ({
  isAssistantDirectModeSupported: () => true,
}));
vi.mock("../../speech", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../speech")>();
  return {
    ...actual,
    hydrateVoiceSettings: async () => actual.loadVoiceSettings(),
    saveVoiceSettingsAsync: async () => true,
  };
});

const { SettingsVoicePage } = await import("./SettingsVoicePage");

describe("SettingsVoicePage", () => {
  let harness: TestHarness;

  beforeEach(async () => {
    await i18n.changeLanguage("zh-Hant");
    harness = createTestHarness();
    window.localStorage.clear();
  });

  afterEach(() => {
    harness.cleanup();
    window.localStorage.clear();
  });

  it("puts auto-speak on a label+switch row instead of a tile", async () => {
    await harness.render(SettingsVoicePage);
    const toggle = harness.container.querySelector('[data-testid="voice-tts-enabled"]');
    expect(toggle?.getAttribute("role")).toBe("switch");
    expect(toggle?.className).not.toContain("im-surface-inset");
    expect(toggle?.parentElement?.className).toContain("items-center");
    expect(harness.container.textContent).toContain("自動朗讀助手回答");
  });

  it("keeps the voice disclaimer as a short caption", async () => {
    await harness.render(SettingsVoicePage);
    expect(harness.container.textContent).toContain("語音只作輸入／朗讀");
    expect(harness.container.textContent).not.toContain("Agent 只處理文字");
  });

  it("frames STT and TTS as two panel cards on one row", async () => {
    await harness.render(SettingsVoicePage);

    const sttCard = harness.container.querySelector('[data-testid="voice-stt-card"]');
    const ttsCard = harness.container.querySelector('[data-testid="voice-tts-card"]');
    const autoSpeakCard = harness.container.querySelector('[data-testid="voice-auto-speak-card"]');
    const sessionCard = harness.container.querySelector('[data-testid="voice-session-card"]');
    expect(sttCard?.className).toContain("im-material-panel");
    expect(ttsCard?.className).toContain("im-material-panel");
    expect(autoSpeakCard?.className).toContain("im-material-panel");
    expect(sessionCard?.className).toContain("im-material-panel");

    const grid = sttCard?.parentElement;
    expect(grid?.className).toContain("md:grid-cols-2");
    expect(grid).toBe(ttsCard?.parentElement);
    expect(grid?.contains(autoSpeakCard)).toBe(false);
    expect(grid?.contains(sessionCard)).toBe(false);

    expect(sttCard?.querySelector("#voice-stt-provider")).not.toBeNull();
    expect(ttsCard?.querySelector("#voice-tts-provider")).not.toBeNull();
    expect(ttsCard?.querySelector('[data-testid="voice-tts-voice"]')).not.toBeNull();
    expect(ttsCard?.querySelector('[data-testid="voice-tts-preview"]')).not.toBeNull();
    expect(sttCard?.getAttribute("aria-label")).toBe("聽寫 STT");
    expect(ttsCard?.getAttribute("aria-label")).toBe("朗讀 TTS");
  });

  it("hosts auto-speak as a plain switch inside its own card", async () => {
    await harness.render(SettingsVoicePage);
    const autoSpeakCard = harness.container.querySelector('[data-testid="voice-auto-speak-card"]');
    const toggle = autoSpeakCard?.querySelector('[data-testid="voice-tts-enabled"]');
    expect(toggle?.getAttribute("role")).toBe("switch");
    expect(toggle?.className).not.toContain("im-surface-inset");
    expect(toggle?.className).not.toContain("border-accent");
    expect(autoSpeakCard?.textContent).toContain("自動朗讀助手回答");
    expect(autoSpeakCard?.querySelector("#voice-tts-provider")).toBeNull();
  });

  it("groups language, PTT, and workset in one session card", async () => {
    await harness.render(SettingsVoicePage);

    const sessionCard = harness.container.querySelector('[data-testid="voice-session-card"]');
    const sttCard = harness.container.querySelector('[data-testid="voice-stt-card"]');
    const language = sessionCard?.querySelector("#voice-speech-language");
    const ptt = sessionCard?.querySelector('[data-testid="voice-space-ptt-mode"]');
    const workset = sessionCard?.querySelector('[data-testid="voice-default-calendar-workset"]');
    expect(sessionCard?.getAttribute("aria-label")).toBe("語言／PTT／工作集");
    expect(language).not.toBeNull();
    expect(ptt).not.toBeNull();
    expect(workset).not.toBeNull();

    const innerGrid = Array.from(sessionCard?.querySelectorAll("div") ?? []).find((el) =>
      el.className.includes("md:grid-cols-2"),
    );
    expect(innerGrid).toBeTruthy();
    expect(innerGrid?.contains(language)).toBe(true);
    expect(innerGrid?.contains(ptt)).toBe(true);
    expect(innerGrid?.contains(workset)).toBe(false);
    expect(sttCard?.contains(language)).toBe(false);
  });
});
