import { isElectronDesktop } from "../electron/electronWindow";
import i18n from "../i18n";
import type { SttEvent, SttPort, SttStartOptions } from "./SttPort";
import {
  getSpeechRecognitionCtor,
  type SpeechRecognitionLike,
} from "./speechRecognition";

const DEFAULT_LANG = "zh-HK";
/** Brief gap before restarting after Chrome ends a recognition segment. */
const RESTART_DELAY_MS = 60;

/**
 * Browser Web Speech STT adapter (`SpeechRecognition` / `webkitSpeechRecognition`).
 * Partial results stream as `partial`; recognition end emits `final`.
 *
 * Chrome still ends sessions after silence / network segments even with
 * ``continuous: true``. While the user holds PTT we restart automatically so
 * longer utterances keep being captured.
 *
 * Unavailable in the Electron desktop shell: the API often exists but Google's
 * cloud recognizer returns a persistent `network` error there.
 */
export class BrowserStt implements SttPort {
  readonly providerId = "browser" as const;

  private recognition: SpeechRecognitionLike | null = null;
  private handlers = new Set<(ev: SttEvent) => void>();
  private lastFinal = "";
  private intentionalStop = false;
  /** User still wants listening (PTT held / session open). */
  private sessionActive = false;
  /** Invalidates an in-flight ``start()`` when ``stop()`` (or a newer start) wins the race. */
  private startGeneration = 0;
  private language = DEFAULT_LANG;
  private restartTimer: number | null = null;

  isAvailable(): boolean {
    if (isElectronDesktop()) {
      return false;
    }
    return getSpeechRecognitionCtor() !== null && isSecureSpeechContext();
  }

  subscribe(handler: (ev: SttEvent) => void): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  async start(opts?: SttStartOptions): Promise<void> {
    if (isElectronDesktop()) {
      this.emit({
        type: "error",
        message: String(i18n.t("common:speech.sttDesktopUnavailable")),
      });
      return;
    }
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor || !isSecureSpeechContext()) {
      this.emit({
        type: "error",
        message: String(i18n.t("common:speech.sttUnsupported")),
      });
      return;
    }

    const generation = ++this.startGeneration;
    this.clearRestartTimer();
    // Pause session flags while tearing down any prior engine so its ``onend``
    // does not schedule a restart into the new session.
    this.sessionActive = false;
    this.intentionalStop = true;
    await this.stopRecognitionOnly();

    // ``stop()`` (or a newer ``start``) won while we awaited teardown — do not revive.
    if (generation !== this.startGeneration) {
      return;
    }

    this.sessionActive = true;
    this.intentionalStop = false;
    this.lastFinal = "";
    this.language = opts?.language?.trim() || DEFAULT_LANG;
    this.beginRecognition(Ctor);
  }

  async stop(): Promise<void> {
    this.startGeneration += 1;
    this.sessionActive = false;
    this.intentionalStop = true;
    this.clearRestartTimer();
    await this.stopRecognitionOnly();
  }

  private beginRecognition(Ctor: NonNullable<ReturnType<typeof getSpeechRecognitionCtor>>): void {
    if (!this.sessionActive || this.recognition) {
      return;
    }

    const recognition = new Ctor();
    recognition.lang = this.language;
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (ev) => {
      let interim = "";
      let finalChunk = "";
      for (let i = ev.resultIndex; i < ev.results.length; i += 1) {
        const result = ev.results[i];
        if (!result) continue;
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) {
          finalChunk += transcript;
        } else {
          interim += transcript;
        }
      }
      if (finalChunk) {
        this.lastFinal = `${this.lastFinal}${finalChunk}`.trim();
        this.emit({ type: "final", text: this.lastFinal });
      }
      if (interim) {
        const combined = `${this.lastFinal} ${interim}`.trim();
        this.emit({ type: "partial", text: combined });
      }
    };

    recognition.onerror = (ev) => {
      const code = ev.error ?? "unknown";
      if (code === "aborted" && this.intentionalStop) {
        return;
      }
      // Chrome ends the session after brief silence; we restart on ``onend``.
      if (code === "no-speech") {
        return;
      }
      // Fatal for this attempt — still allow onend restart if session held,
      // except network (usually unrecoverable in-page).
      if (code === "network") {
        this.sessionActive = false;
        this.emit({
          type: "error",
          message: speechErrorMessage(code, ev.message),
        });
        return;
      }
      this.emit({
        type: "error",
        message: speechErrorMessage(code, ev.message),
      });
    };

    recognition.onend = () => {
      if (this.recognition === recognition) {
        this.recognition = null;
      }
      if (this.lastFinal) {
        this.emit({ type: "final", text: this.lastFinal });
      }
      if (this.sessionActive && !this.intentionalStop) {
        this.scheduleRestart();
      }
    };

    this.recognition = recognition;
    try {
      recognition.start();
    } catch (error) {
      this.recognition = null;
      if (this.sessionActive && !this.intentionalStop) {
        this.scheduleRestart();
        return;
      }
      this.emit({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : String(i18n.t("common:speech.sttStartFailed")),
      });
    }
  }

  private scheduleRestart(): void {
    this.clearRestartTimer();
    this.restartTimer = window.setTimeout(() => {
      this.restartTimer = null;
      if (!this.sessionActive || this.intentionalStop || this.recognition) {
        return;
      }
      const Ctor = getSpeechRecognitionCtor();
      if (!Ctor) return;
      this.beginRecognition(Ctor);
    }, RESTART_DELAY_MS);
  }

  private clearRestartTimer(): void {
    if (this.restartTimer !== null) {
      window.clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
  }

  /** Stop the active recognition engine; resolve after ``onend`` or timeout. */
  private stopRecognitionOnly(): Promise<void> {
    const recognition = this.recognition;
    if (!recognition) {
      return Promise.resolve();
    }
    this.recognition = null;

    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        resolve();
      };

      const prevOnEnd = recognition.onend;
      const timer = window.setTimeout(finish, 1500);
      recognition.onend = () => {
        try {
          prevOnEnd?.();
        } finally {
          finish();
        }
      };

      try {
        recognition.stop();
      } catch {
        try {
          recognition.abort();
        } catch {
          /* ignore */
        }
        finish();
      }
    });
  }

  private emit(ev: SttEvent): void {
    for (const handler of this.handlers) {
      handler(ev);
    }
  }
}

function isSecureSpeechContext(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  if (window.isSecureContext) {
    return true;
  }
  const host = window.location?.hostname ?? "";
  return host === "localhost" || host === "127.0.0.1";
}

function speechErrorMessage(code: string, detail?: string): string {
  switch (code) {
    case "audio-capture":
      return String(i18n.t("common:speech.sttNoMic"));
    case "not-allowed":
    case "service-not-allowed":
      return String(i18n.t("common:speech.sttNotAllowed"));
    case "network":
      return String(i18n.t("common:speech.sttNetwork"));
    default:
      return detail?.trim() || String(i18n.t("common:speech.sttErrorCode", { code }));
  }
}
