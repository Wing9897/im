import type { TtsPort, TtsSpeakOptions } from "../speech";
import {
  playVoiceReminderPreamble,
  type PreambleChimeId,
} from "./preambleChime";
import { loadVoiceReminderSettings } from "./settings";
import i18n from "../i18n";

/**
 * Broadcast preamble + TTS speak for voice reminders (scanner + 試播).
 * Uses `preambleChimeId` from opts, otherwise the saved voice-reminder setting.
 */
export async function announceVoiceReminder(
  tts: TtsPort,
  text: string,
  opts?: TtsSpeakOptions & { preambleChimeId?: PreambleChimeId },
): Promise<void> {
  const { preambleChimeId: overrideChimeId, ...ttsOpts } = opts ?? {};
  const chimeId =
    overrideChimeId ?? loadVoiceReminderSettings().preambleChimeId;
  await playVoiceReminderPreamble(chimeId);
  await tts.speak(text, ttsOpts);
}

export function voiceReminderTtsUnavailableMessage(): string {
  return String(i18n.t("messages.speakTtsUnavailable"));
}

export function voiceReminderSpeakFailedMessage(): string {
  return String(i18n.t("messages.speakFailed"));
}
