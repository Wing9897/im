import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BrowserTts } from "./BrowserTts";

class MockUtterance {
  text: string;
  lang = "";
  rate = 1;
  voice: SpeechSynthesisVoice | null = null;
  onend: ((ev: { error?: string }) => void) | null = null;
  onerror: ((ev: { error?: string }) => void) | null = null;

  constructor(text: string) {
    this.text = text;
  }
}

describe("BrowserTts", () => {
  let speak: ReturnType<typeof vi.fn>;
  let cancel: ReturnType<typeof vi.fn>;
  let lastUtterance: MockUtterance | null;

  beforeEach(() => {
    lastUtterance = null;
    vi.stubGlobal("SpeechSynthesisUtterance", MockUtterance);
    speak = vi.fn((utterance: MockUtterance) => {
      lastUtterance = utterance;
      queueMicrotask(() => {
        utterance.onend?.({});
      });
    });
    cancel = vi.fn();
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        speak,
        cancel,
        getVoices: () => [
          {
            voiceURI: "tracy-uri",
            name: "Microsoft Tracy",
            lang: "zh-HK",
            localService: true,
          } as SpeechSynthesisVoice,
        ],
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete (window as Window & { speechSynthesis?: unknown }).speechSynthesis;
  });

  it("speaks text via speechSynthesis", async () => {
    const tts = new BrowserTts();
    expect(tts.isAvailable()).toBe(true);

    await tts.speak("你好", { lang: "zh-HK", rate: 1.1 });

    expect(speak).toHaveBeenCalledTimes(1);
    expect(lastUtterance?.text).toBe("你好");
    expect(lastUtterance?.lang).toBe("zh-HK");
    expect(lastUtterance?.rate).toBeCloseTo(1.1);
  });

  it("assigns voice when voiceUri matches", async () => {
    const tts = new BrowserTts();
    await tts.speak("試聽", { lang: "zh-HK", voiceUri: "tracy-uri" });
    expect(lastUtterance?.voice?.name).toBe("Microsoft Tracy");
  });

  it("cancel stops speech", async () => {
    const tts = new BrowserTts();
    speak.mockImplementation(() => {
      /* leave pending */
    });
    const pending = tts.speak("長篇回答");
    tts.cancel();
    await pending;
    expect(cancel).toHaveBeenCalled();
  });

  it("no-ops speak on empty text", async () => {
    const tts = new BrowserTts();
    await tts.speak("   ");
    expect(speak).not.toHaveBeenCalled();
  });
});
