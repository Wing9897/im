import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BrowserStt } from "./BrowserStt";
import type { SpeechRecognitionLike, SpeechRecognitionResultEventLike } from "./speechRecognition";

class MockSpeechRecognition implements SpeechRecognitionLike {
  lang = "";
  continuous = false;
  interimResults = false;
  onresult: ((ev: SpeechRecognitionResultEventLike) => void) | null = null;
  onerror: ((ev: { error?: string; message?: string }) => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn(() => {
    this.onend?.();
  });
  abort = vi.fn();
}

describe("BrowserStt", () => {
  let recognition: MockSpeechRecognition;

  beforeEach(() => {
    recognition = new MockSpeechRecognition();
    const Ctor = vi.fn(() => recognition);
    Object.defineProperty(window, "SpeechRecognition", {
      configurable: true,
      writable: true,
      value: Ctor,
    });
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: true,
    });
  });

  afterEach(() => {
    delete (window as Window & { SpeechRecognition?: unknown }).SpeechRecognition;
  });

  it("reports available when SpeechRecognition exists in a secure context", () => {
    const stt = new BrowserStt();
    expect(stt.isAvailable()).toBe(true);
    expect(stt.providerId).toBe("browser");
  });

  it("emits final text from recognition results", async () => {
    const stt = new BrowserStt();
    const events: Array<{ type: string; text?: string }> = [];
    stt.subscribe((ev) => {
      if (ev.type === "partial" || ev.type === "final") {
        events.push({ type: ev.type, text: ev.text });
      }
    });

    await stt.start({ language: "zh-HK" });
    expect(recognition.start).toHaveBeenCalled();
    expect(recognition.lang).toBe("zh-HK");
    expect(recognition.interimResults).toBe(true);

    recognition.onresult?.({
      resultIndex: 0,
      results: [
        {
          isFinal: true,
          0: { transcript: "最近一星期有沒有家庭事務" },
        },
      ],
    });

    expect(events).toContainEqual({
      type: "final",
      text: "最近一星期有沒有家庭事務",
    });

    await stt.stop();
    expect(recognition.stop).toHaveBeenCalled();
  });

  it("emits partial then final for interim results", async () => {
    const stt = new BrowserStt();
    const texts: string[] = [];
    stt.subscribe((ev) => {
      if (ev.type === "partial" || ev.type === "final") {
        texts.push(`${ev.type}:${ev.text}`);
      }
    });

    await stt.start();
    recognition.onresult?.({
      resultIndex: 0,
      results: [{ isFinal: false, 0: { transcript: "最近" } }],
    });
    recognition.onresult?.({
      resultIndex: 0,
      results: [{ isFinal: true, 0: { transcript: "最近七天" } }],
    });

    expect(texts).toEqual(["partial:最近", "final:最近七天"]);
  });

  it("restarts recognition when Chrome ends the session while PTT is held", async () => {
    vi.useFakeTimers();
    const stt = new BrowserStt();
    const Ctor = window.SpeechRecognition as unknown as ReturnType<typeof vi.fn>;
    await stt.start({ language: "zh-HK" });
    expect(Ctor).toHaveBeenCalledTimes(1);
    expect(recognition.start).toHaveBeenCalledTimes(1);

    const first = recognition;
    recognition = new MockSpeechRecognition();
    Ctor.mockImplementation(() => recognition);
    first.onend?.();

    await vi.advanceTimersByTimeAsync(80);
    expect(Ctor).toHaveBeenCalledTimes(2);
    expect(recognition.start).toHaveBeenCalledTimes(1);

    await stt.stop();
    vi.useRealTimers();
  });

  it("does not restart after an intentional stop", async () => {
    vi.useFakeTimers();
    const stt = new BrowserStt();
    const Ctor = window.SpeechRecognition as unknown as ReturnType<typeof vi.fn>;
    await stt.start();
    expect(Ctor).toHaveBeenCalledTimes(1);

    await stt.stop();
    recognition = new MockSpeechRecognition();
    Ctor.mockImplementation(() => recognition);
    await vi.advanceTimersByTimeAsync(200);
    expect(recognition.start).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("stop during in-flight start does not revive recognition", async () => {
    const stt = new BrowserStt();
    const Ctor = window.SpeechRecognition as unknown as ReturnType<typeof vi.fn>;

    // First session so stopRecognitionOnly awaits onend.
    await stt.start();
    expect(Ctor).toHaveBeenCalledTimes(1);
    const first = recognition;
    first.stop = vi.fn(() => {
      /* defer onend so start()'s await stays pending */
    });

    recognition = new MockSpeechRecognition();
    Ctor.mockImplementation(() => recognition);

    const startPromise = stt.start();
    // Release while teardown of the prior engine is still awaiting onend.
    const stopPromise = stt.stop();
    first.onend?.();
    await Promise.all([startPromise, stopPromise]);

    expect(recognition.start).not.toHaveBeenCalled();
  });

  it("is unavailable without SpeechRecognition", () => {
    delete (window as Window & { SpeechRecognition?: unknown }).SpeechRecognition;
    const stt = new BrowserStt();
    expect(stt.isAvailable()).toBe(false);
  });

  it("is unavailable in the Electron desktop shell", () => {
    window.electronWindow = {
      isDesktopShell: true,
      getState: async () => ({ isMaximized: false }),
      minimize: () => undefined,
      toggleMaximize: () => undefined,
      close: () => undefined,
      onMaximizedChange: () => () => undefined,
    };
    const stt = new BrowserStt();
    expect(stt.isAvailable()).toBe(false);
    delete window.electronWindow;
  });
});
