import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestHarness, type TestHarness } from "../../test/render-helpers";
import i18n from "../../i18n";

vi.mock("../../context/ToastContext", async () =>
  (await import("../../test/context-mocks")).toastContextModuleMock());
vi.mock("../../context/TaskCatalogContext", async () =>
  (await import("../../test/context-mocks")).taskCatalogModuleMock());
vi.mock("../../speech/useBrowserTtsVoiceOptions", () => ({
  useBrowserTtsVoiceOptions: vi.fn(() => []),
}));
vi.mock("../../domain/assistant/directModeSupport", () => ({
  isAssistantDirectModeSupported: vi.fn(() => true),
}));
vi.mock("../../speech", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../speech")>();
  return {
    ...actual,
    hydrateVoiceSettings: async () => actual.loadVoiceSettings(),
    saveVoiceSettingsAsync: async () => true,
  };
});

const { isAssistantDirectModeSupported } = await import(
  "../../domain/assistant/directModeSupport"
);
const { useBrowserTtsVoiceOptions } = await import("../../speech/useBrowserTtsVoiceOptions");
const { SettingsVoicePage } = await import("./SettingsVoicePage");

describe("SettingsVoicePage", () => {
  let harness: TestHarness;

  beforeEach(async () => {
    await i18n.changeLanguage("zh-Hant");
    vi.mocked(isAssistantDirectModeSupported).mockReturnValue(true);
    vi.mocked(useBrowserTtsVoiceOptions).mockReturnValue([]);
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

  it("explains that the voice list is what Web Speech API returns", async () => {
    await harness.render(SettingsVoicePage);
    const ttsCard = harness.container.querySelector('[data-testid="voice-tts-card"]');
    expect(ttsCard?.textContent).toContain("清單即桌面 Web Speech API 回傳的語音");
    expect(ttsCard?.textContent).toContain("Windows 設定 → 時間與語言 → 語音");
  });

  it("lists every getVoices() option after 系統預設, without capping", async () => {
    vi.mocked(useBrowserTtsVoiceOptions).mockReturnValue([
      {
        voiceURI: "uri-danny",
        name: "Microsoft Danny",
        lang: "zh-HK",
        localService: true,
        label: "Microsoft Danny · zh-HK · 本機",
      },
      {
        voiceURI: "uri-tracy",
        name: "Microsoft Tracy",
        lang: "zh-HK",
        localService: true,
        label: "Microsoft Tracy · zh-HK · 本機",
      },
      {
        voiceURI: "uri-zira",
        name: "Microsoft Zira",
        lang: "en-US",
        localService: true,
        label: "Microsoft Zira · en-US · 本機",
      },
    ]);
    await harness.render(SettingsVoicePage);

    const trigger = harness.container.querySelector(
      '[data-testid="voice-tts-voice-value"]',
    ) as HTMLButtonElement | null;
    await act(async () => {
      trigger?.click();
    });

    const list = document.body.querySelector('[data-testid="voice-tts-voice-list"]');
    const options = list?.querySelectorAll('[role="option"]') ?? [];
    expect(options).toHaveLength(4);
    expect(options[0]?.textContent).toContain("系統預設");
    expect(list?.textContent).toContain("Microsoft Danny");
    expect(list?.textContent).toContain("Microsoft Tracy");
    expect(list?.textContent).toContain("Microsoft Zira");
    expect(list?.textContent).toContain("zh-HK");
    expect(list?.textContent).toContain("en-US");
    expect(list?.querySelector('[data-testid="voice-tts-voice-search"]')).toBeNull();
    expect(list?.style.zIndex).toBe("3000");
  });

  it("adds in-menu search when Chromium returns a long voice list", async () => {
    vi.mocked(useBrowserTtsVoiceOptions).mockReturnValue(
      Array.from({ length: 10 }, (_, i) => ({
        voiceURI: `uri-${i}`,
        name: `Voice ${i}`,
        lang: i < 5 ? "zh-HK" : "en-US",
        localService: true,
        label: `Voice ${i} · ${i < 5 ? "zh-HK" : "en-US"} · 本機`,
      })),
    );
    await harness.render(SettingsVoicePage);

    const trigger = harness.container.querySelector(
      '[data-testid="voice-tts-voice-value"]',
    ) as HTMLButtonElement | null;
    await act(async () => {
      trigger?.click();
    });

    const list = document.body.querySelector('[data-testid="voice-tts-voice-list"]');
    expect(list?.querySelector('[data-testid="voice-tts-voice-search"]')).toBeTruthy();
    expect(list?.querySelectorAll('[role="option"]')).toHaveLength(11);
  });

  it("uses portaled MenuSelect for STT/TTS instead of native select", async () => {
    await harness.render(SettingsVoicePage);

    expect(harness.container.querySelector("select")).toBeNull();
    const sttTrigger = harness.container.querySelector("#voice-stt-provider");
    const ttsTrigger = harness.container.querySelector("#voice-tts-provider");
    const voiceTrigger = harness.container.querySelector('[data-testid="voice-tts-voice-value"]');
    const pttTrigger = harness.container.querySelector('[data-testid="voice-space-ptt-mode-value"]');
    expect(sttTrigger?.tagName).toBe("BUTTON");
    expect(sttTrigger?.getAttribute("aria-haspopup")).toBe("listbox");
    expect(ttsTrigger?.tagName).toBe("BUTTON");
    expect(voiceTrigger?.getAttribute("aria-haspopup")).toBe("listbox");
    expect(pttTrigger?.getAttribute("aria-haspopup")).toBe("listbox");

    await act(async () => {
      (voiceTrigger as HTMLButtonElement | null)?.click();
    });

    const list = document.body.querySelector('[data-testid="voice-tts-voice-list"]') as HTMLElement | null;
    expect(list).toBeTruthy();
    expect(harness.container.querySelector('[data-testid="voice-tts-voice-list"]')).toBeNull();
    expect(list?.parentElement).toBe(document.body);
    expect(list?.style.zIndex).toBe("3000");
    expect(list?.style.background).toContain("--surface-raised");
    expect(list?.style.color).toContain("--text-primary");
  });

  it("still shows the desktop STT unsupported message when PTT is blocked", async () => {
    vi.mocked(isAssistantDirectModeSupported).mockReturnValue(false);
    await harness.render(SettingsVoicePage);
    const notice = harness.container.querySelector('[data-testid="voice-stt-desktop-unavailable"]');
    expect(notice).not.toBeNull();
    expect(notice?.textContent).toContain("桌面版不支援瀏覽器語音辨識");
  });
});
