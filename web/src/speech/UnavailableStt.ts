import i18n from "../i18n";
import type { SttEvent, SttPort, SttStartOptions } from "./SttPort";

/**
 * STT stub for environments where browser speech must never run (Electron).
 * Does not touch SpeechRecognition or the microphone.
 */
export class UnavailableStt implements SttPort {
  readonly providerId = "browser" as const;

  private handlers = new Set<(ev: SttEvent) => void>();

  isAvailable(): boolean {
    return false;
  }

  subscribe(handler: (ev: SttEvent) => void): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  start(_opts?: SttStartOptions): Promise<void> {
    for (const handler of this.handlers) {
      handler({
        type: "error",
        message: String(i18n.t("common:speech.sttDesktopUnavailable")),
      });
    }
    return Promise.resolve();
  }

  stop(): Promise<void> {
    /* no-op — never opened a recognition session */
    return Promise.resolve();
  }
}
