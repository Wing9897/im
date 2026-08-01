import { isElectronDesktop } from "../../electron/electronWindow";

/**
 * Whether global Space-PTT / “hold to talk” caption mode can work.
 *
 * Electron shell: browser Web Speech STT is dead (cloud `network` errors).
 * Whisper / Doubao adapters are not wired yet (`createSpeechPorts` falls back
 * to BrowserStt), so desktop always returns false until a real local adapter
 * lands — do not gate on `sttProvider === "whisper"` alone.
 *
 * Browser tab: returns true here; runtime still checks `SttPort.isAvailable()`
 * (secure context + SpeechRecognition).
 */
export function isAssistantDirectModeSupported(): boolean {
  return !isElectronDesktop();
}
