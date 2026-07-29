import { isElectronDesktop } from "../electron/electronWindow";
import { BrowserStt } from "./BrowserStt";
import { BrowserTts } from "./BrowserTts";
import type { SttPort, SttProviderId } from "./SttPort";
import type { TtsPort, TtsProviderId } from "./TtsPort";
import { UnavailableStt } from "./UnavailableStt";
import { loadVoiceSettings } from "./voiceSettings";

export interface SpeechPorts {
  stt: SttPort;
  tts: TtsPort;
}

export interface CreateSpeechPortsOptions {
  sttProvider?: SttProviderId;
  ttsProvider?: TtsProviderId;
}

/**
 * Factory for STT/TTS ports from settings.
 *
 * Electron: always ``UnavailableStt`` (never constructs Web Speech / mic).
 * Desktop shell can stay running for collectors while the user speaks in a
 * normal browser tab against the same local API.
 *
 * Unimplemented whisper/doubao ids fall back to BrowserStt in the browser only
 * — that fallback is NOT a working Whisper/Doubao path.
 */
export function createSpeechPorts(opts?: CreateSpeechPortsOptions): SpeechPorts {
  const settings = loadVoiceSettings();
  const sttProvider = opts?.sttProvider ?? settings.sttProvider;
  const ttsProvider = opts?.ttsProvider ?? settings.ttsProvider;

  return {
    stt: createSttPort(sttProvider),
    tts: createTtsPort(ttsProvider),
  };
}

function createSttPort(providerId: SttProviderId): SttPort {
  if (isElectronDesktop()) {
    return new UnavailableStt();
  }
  switch (providerId) {
    case "whisper":
    case "doubao":
      // NOT IMPLEMENTED — reserved ids only. Fall back to BrowserStt so callers
      // do not crash; still unavailable on Electron (handled above).
      return new BrowserStt();
    case "browser":
    default:
      return new BrowserStt();
  }
}

function createTtsPort(providerId: TtsProviderId): TtsPort {
  switch (providerId) {
    case "doubao":
      // NOT IMPLEMENTED — reserved id; fall back to BrowserTts (not a Doubao adapter).
      return new BrowserTts();
    case "browser":
    default:
      return new BrowserTts();
  }
}
