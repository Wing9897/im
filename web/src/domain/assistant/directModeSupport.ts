import { isElectronDesktop } from "../../electron/electronWindow";

/**
 * Whether global Space-PTT / “hold to talk” caption mode can work.
 *
 * Electron shell: browser Web Speech STT is dead (cloud `network` errors), so
 * desktop always returns false. Only the browser provider is implemented.
 *
 * Browser tab: returns true here; runtime still checks `SttPort.isAvailable()`
 * (secure context + SpeechRecognition).
 */
export function isAssistantDirectModeSupported(): boolean {
  return !isElectronDesktop();
}
