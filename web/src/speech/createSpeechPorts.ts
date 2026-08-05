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
 * Only the browser provider is implemented; unknown / legacy ids use browser adapters.
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

function createSttPort(_providerId: SttProviderId): SttPort {
  if (isElectronDesktop()) {
    return new UnavailableStt();
  }
  return new BrowserStt();
}

function createTtsPort(_providerId: TtsProviderId): TtsPort {
  return new BrowserTts();
}
