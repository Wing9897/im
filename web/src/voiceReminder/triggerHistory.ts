/** Audit log for voice-reminder speaks (merged into 通知 → 觸發紀錄). */

import {
  fetchVoiceReminderHistory,
  putVoiceReminderHistory,
} from "../api/uiPrefs";
import i18n from "../i18n";
import { logWarn } from "../utils/logger";

import { VOICE_REMINDER_HISTORY_CHANGED_EVENT } from "./voiceReminderPersistedKeys";

const MAX_ENTRIES = 100;

/** Same-tab signal so the history tab can refresh after a speak. */
export { VOICE_REMINDER_HISTORY_CHANGED_EVENT };

export interface VoiceReminderTriggerEntry {
  id: string;
  /** Display line, e.g. 語音提醒 · 提前約一小時 · 「標題」 */
  triggerReason: string;
  status: "success" | "failure";
  errorMessage: string | null;
  triggeredAt: string;
  eventId?: string;
  title?: string;
  leadOffsetMinutes?: number;
}

type VoiceReminderTriggerInput = {
  triggerReason: string;
  status: "success" | "failure";
  errorMessage?: string | null;
  eventId?: string;
  title?: string;
  leadOffsetMinutes?: number;
  triggeredAt?: string;
};

let cachedEntries: VoiceReminderTriggerEntry[] | null = null;
let hydrateHistoryPromise: Promise<VoiceReminderTriggerEntry[]> | null = null;

function isEntry(value: unknown): value is VoiceReminderTriggerEntry {
  if (value == null || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.triggerReason === "string" &&
    (row.status === "success" || row.status === "failure") &&
    (row.errorMessage == null || typeof row.errorMessage === "string") &&
    typeof row.triggeredAt === "string"
  );
}

function sanitizeEntries(raw: unknown): VoiceReminderTriggerEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isEntry).slice(0, MAX_ENTRIES);
}

function setCache(entries: VoiceReminderTriggerEntry[], notify: boolean): void {
  cachedEntries = entries.slice(0, MAX_ENTRIES);
  if (notify && typeof window !== "undefined") {
    window.dispatchEvent(new Event(VOICE_REMINDER_HISTORY_CHANGED_EVENT));
  }
}

/** Sync read from memory cache (empty list before hydrate). */
export function loadVoiceReminderTriggers(): VoiceReminderTriggerEntry[] {
  if (cachedEntries) {
    return cachedEntries.slice();
  }
  return [];
}

/** Hydrate history from server. Empty server → empty list. */
export async function hydrateVoiceReminderHistory(): Promise<VoiceReminderTriggerEntry[]> {
  if (!hydrateHistoryPromise) {
    hydrateHistoryPromise = (async () => {
      try {
        const response = await fetchVoiceReminderHistory();
        if (response.configured && Array.isArray(response.entries)) {
          const entries = sanitizeEntries(response.entries);
          setCache(entries, true);
          return loadVoiceReminderTriggers();
        }

        setCache([], false);
        return [];
      } catch (error) {
        logWarn("[voiceReminder] failed to hydrate history", error);
        const fallback = loadVoiceReminderTriggers();
        setCache(fallback, false);
        return fallback;
      }
    })().finally(() => {
      hydrateHistoryPromise = null;
    });
  }
  return hydrateHistoryPromise;
}

async function persistEntries(entries: VoiceReminderTriggerEntry[]): Promise<boolean> {
  const next = entries.slice(0, MAX_ENTRIES);
  setCache(next, true);
  try {
    const saved = await putVoiceReminderHistory(next);
    if (Array.isArray(saved.entries)) {
      setCache(sanitizeEntries(saved.entries), false);
    }
    return true;
  } catch (error) {
    logWarn("[voiceReminder] failed to save history", error);
    return false;
  }
}

/**
 * Prepend a voice-reminder trigger row (newest first).
 * Updates memory immediately; returns `{ entry, persisted }`.
 */
export async function appendVoiceReminderTrigger(
  input: VoiceReminderTriggerInput,
): Promise<{ entry: VoiceReminderTriggerEntry; persisted: boolean }> {
  const entry: VoiceReminderTriggerEntry = {
    id: crypto.randomUUID(),
    triggerReason: input.triggerReason,
    status: input.status,
    errorMessage: input.errorMessage ?? null,
    triggeredAt: input.triggeredAt ?? new Date().toISOString(),
    eventId: input.eventId,
    title: input.title,
    leadOffsetMinutes: input.leadOffsetMinutes,
  };
  const next = [entry, ...loadVoiceReminderTriggers()].slice(0, MAX_ENTRIES);
  const persisted = await persistEntries(next);
  return { entry, persisted };
}

export function buildVoiceReminderTriggerReason(
  title: string,
  leadPhrase: string,
): string {
  const eventTitle = title.trim() || String(i18n.t("messages.speakKindEvent"));
  return String(
    i18n.t("messages.voiceTriggerReason", { lead: leadPhrase, title: eventTitle }),
  );
}

/** Test helper: reset in-memory history cache between cases. */
export function resetVoiceReminderHistoryCacheForTests(): void {
  cachedEntries = null;
  hydrateHistoryPromise = null;
}
