import i18n from "../i18n";
import { resolveBrowserTtsVoice } from "./browserTtsVoices";
import type { TtsPort, TtsSpeakOptions } from "./TtsPort";

const DEFAULT_LANG = "zh-HK";

/**
 * Browser `speechSynthesis` TTS adapter.
 */
export class BrowserTts implements TtsPort {
  readonly providerId = "browser" as const;

  private speakingResolve: (() => void) | null = null;

  isAvailable(): boolean {
    return typeof window !== "undefined" && typeof window.speechSynthesis !== "undefined";
  }

  speak(text: string, opts?: TtsSpeakOptions): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed) {
      return Promise.resolve();
    }
    if (!this.isAvailable()) {
      return Promise.reject(new Error(String(i18n.t("common:speech.ttsUnsupported"))));
    }

    this.cancel();

    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(trimmed);
      utterance.lang = opts?.lang?.trim() || DEFAULT_LANG;
      if (opts?.rate != null && Number.isFinite(opts.rate)) {
        utterance.rate = Math.min(2, Math.max(0.5, opts.rate));
      }
      const voice = resolveBrowserTtsVoice(opts?.voiceUri ?? "");
      if (voice) {
        utterance.voice = voice;
      }

      this.speakingResolve = resolve;
      utterance.onend = () => {
        this.speakingResolve = null;
        resolve();
      };
      utterance.onerror = (ev) => {
        this.speakingResolve = null;
        if (ev.error === "canceled" || ev.error === "interrupted") {
          resolve();
          return;
        }
        reject(
          new Error(ev.error || String(i18n.t("common:speech.ttsFailed"))),
        );
      };

      try {
        window.speechSynthesis.speak(utterance);
      } catch (error) {
        this.speakingResolve = null;
        reject(
          error instanceof Error
            ? error
            : new Error(String(i18n.t("common:speech.ttsFailed"))),
        );
      }
    });
  }

  cancel(): void {
    if (!this.isAvailable()) {
      return;
    }
    const pending = this.speakingResolve;
    this.speakingResolve = null;
    window.speechSynthesis.cancel();
    pending?.();
  }
}
