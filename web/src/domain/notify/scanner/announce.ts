import type { TtsPort, TtsSpeakOptions } from "../../../speech";
import {
  playNotifyPreamble,
  type PreambleChimeId,
} from "./preambleChime";
import { loadNotifySettings } from "./settings";
import i18n from "../../../i18n";

/**
 * Broadcast preamble + TTS speak for local notify (scanner + 試播).
 * Uses `preambleChimeId` from opts, otherwise the saved notify setting.
 */
export async function announceNotify(
  tts: TtsPort,
  text: string,
  opts?: TtsSpeakOptions & { preambleChimeId?: PreambleChimeId },
): Promise<void> {
  const { preambleChimeId: overrideChimeId, ...ttsOpts } = opts ?? {};
  const chimeId =
    overrideChimeId ?? loadNotifySettings().preambleChimeId;
  await playNotifyPreamble(chimeId);
  await tts.speak(text, ttsOpts);
}

export function notifyTtsUnavailableMessage(): string {
  return String(i18n.t("messages.speakTtsUnavailable"));
}

export function notifySpeakFailedMessage(): string {
  return String(i18n.t("messages.speakFailed"));
}
