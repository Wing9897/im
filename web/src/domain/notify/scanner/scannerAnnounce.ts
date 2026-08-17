import { showNotifyFlash } from "../notifyFlash";
import { appendRecentInbox } from "../recentInbox";
import { createSpeechPorts, loadVoiceSettings, ttsSpeakOptionsFromVoiceSettings } from "../../../speech";
import { logWarn } from "../../../utils/logger";
import {
  announceVoiceReminder,
  voiceReminderSpeakFailedMessage,
  voiceReminderTtsUnavailableMessage,
} from "./announce";
import {
  appendVoiceReminderTrigger,
  buildVoiceReminderTriggerReason,
} from "./triggerHistory";
import { formatLeadSpeakPhrase, type DueReminder } from "./scanner";

export async function recordDueTrigger(
  item: DueReminder,
  status: "success" | "failure",
  errorMessage?: string,
): Promise<boolean> {
  const { persisted } = await appendVoiceReminderTrigger({
    triggerReason: buildVoiceReminderTriggerReason(
      item.title,
      formatLeadSpeakPhrase(item.leadOffsetMinutes),
    ),
    status,
    ...(errorMessage ? { errorMessage } : {}),
    eventId: item.eventId,
    title: item.title,
    leadOffsetMinutes: item.leadOffsetMinutes,
  });
  return persisted;
}

export async function deliverDueReminders(opts: {
  items: readonly DueReminder[];
  channels: { flash: boolean; speak: boolean; flashPersist: boolean };
  nowMs: number;
  cancelled: () => boolean;
  onPersistFailure: (message: string) => void;
}): Promise<void> {
  const { items, channels, nowMs, cancelled, onPersistFailure } = opts;

  for (const item of items) {
    appendRecentInbox({
      dedupeKey: item.dedupeKey,
      eventId: item.eventId,
      title: item.title,
      startTime: item.startTime,
      remindAtMs: item.remindAtMs,
    }, nowMs);
    if (channels.flash) {
      showNotifyFlash(item.speakText, { persist: channels.flashPersist });
    }
  }

  if (!channels.speak) {
    return;
  }

  const voice = loadVoiceSettings();
  const { tts } = createSpeechPorts();
  if (!tts.isAvailable()) {
    logWarn("[voiceReminder] TTS unavailable; skipping speak");
    for (const item of items) {
      const persisted = await recordDueTrigger(
        item,
        "failure",
        voiceReminderTtsUnavailableMessage(),
      );
      if (!persisted) {
        onPersistFailure("[voiceReminder] failed to persist trigger history");
      }
    }
    return;
  }

  for (const item of items) {
    if (cancelled()) {
      break;
    }
    try {
      await announceVoiceReminder(tts, item.speakText, {
        ...ttsSpeakOptionsFromVoiceSettings(voice),
      });
      const persisted = await recordDueTrigger(item, "success");
      if (!persisted) {
        onPersistFailure("[voiceReminder] failed to persist trigger history");
      }
    } catch (error) {
      logWarn("[voiceReminder] speak failed", error);
      const persisted = await recordDueTrigger(
        item,
        "failure",
        error instanceof Error ? error.message : voiceReminderSpeakFailedMessage(),
      );
      if (!persisted) {
        onPersistFailure("[voiceReminder] failed to persist trigger history");
      }
    }
  }
}
