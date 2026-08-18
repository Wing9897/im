/** Audit log for local-notify speaks (merged into 通知 → 觸發紀錄). */

import {
  fetchNotifyHistory,
  putNotifyHistory,
  type NotifyHistoryEntryPayload,
} from "../../../api/uiPrefs";
import i18n from "../../../i18n";
import { logWarn } from "../../../utils/logger";

import { NOTIFY_HISTORY_CHANGED_EVENT } from "../../prefs";

const MAX_ENTRIES = 100;

/** Same-tab signal so the history tab can refresh after a speak. */
export { NOTIFY_HISTORY_CHANGED_EVENT };

/** OpenAPI ``NotifyHistoryEntrySchema`` (wire SoT). */
export type NotifyTriggerEntry = NotifyHistoryEntryPayload;

type NotifyTriggerInput = {
  triggerReason: string;
  status: "success" | "failure";
  errorMessage?: string | null;
  eventId?: string;
  title?: string;
  leadOffsetMinutes?: number;
  triggeredAt?: string;
};

let cachedEntries: NotifyTriggerEntry[] | null = null;
let hydrateHistoryPromise: Promise<NotifyTriggerEntry[]> | null = null;

function isEntry(value: unknown): value is NotifyTriggerEntry {
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

function sanitizeEntries(raw: unknown): NotifyTriggerEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isEntry).slice(0, MAX_ENTRIES);
}

function setCache(entries: NotifyTriggerEntry[], notify: boolean): void {
  cachedEntries = entries.slice(0, MAX_ENTRIES);
  if (notify && typeof window !== "undefined") {
    window.dispatchEvent(new Event(NOTIFY_HISTORY_CHANGED_EVENT));
  }
}

/** Sync read from memory cache (empty list before hydrate). */
export function loadNotifyTriggers(): NotifyTriggerEntry[] {
  if (cachedEntries) {
    return cachedEntries.slice();
  }
  return [];
}

/** Hydrate history from server. Empty server → empty list. */
export async function hydrateNotifyHistory(): Promise<NotifyTriggerEntry[]> {
  if (!hydrateHistoryPromise) {
    hydrateHistoryPromise = (async () => {
      try {
        const response = await fetchNotifyHistory();
        if (response.configured && Array.isArray(response.entries)) {
          const entries = sanitizeEntries(response.entries);
          setCache(entries, true);
          return loadNotifyTriggers();
        }

        setCache([], false);
        return [];
      } catch (error) {
        logWarn("[notify] failed to hydrate history", error);
        const fallback = loadNotifyTriggers();
        setCache(fallback, false);
        return fallback;
      }
    })().finally(() => {
      hydrateHistoryPromise = null;
    });
  }
  return hydrateHistoryPromise;
}

async function persistEntries(entries: NotifyTriggerEntry[]): Promise<boolean> {
  const next = entries.slice(0, MAX_ENTRIES);
  setCache(next, true);
  try {
    const saved = await putNotifyHistory(next);
    if (Array.isArray(saved.entries)) {
      setCache(sanitizeEntries(saved.entries), false);
    }
    return true;
  } catch (error) {
    logWarn("[notify] failed to save history", error);
    return false;
  }
}

/**
 * Prepend a local-notify trigger row (newest first).
 * Updates memory immediately; returns `{ entry, persisted }`.
 */
export async function appendNotifyTrigger(
  input: NotifyTriggerInput,
): Promise<{ entry: NotifyTriggerEntry; persisted: boolean }> {
  const entry: NotifyTriggerEntry = {
    id: crypto.randomUUID(),
    triggerReason: input.triggerReason,
    status: input.status,
    errorMessage: input.errorMessage ?? null,
    triggeredAt: input.triggeredAt ?? new Date().toISOString(),
    eventId: input.eventId,
    title: input.title,
    leadOffsetMinutes: input.leadOffsetMinutes,
  };
  const next = [entry, ...loadNotifyTriggers()].slice(0, MAX_ENTRIES);
  const persisted = await persistEntries(next);
  return { entry, persisted };
}

export function buildNotifyTriggerReason(
  title: string,
  leadPhrase: string,
): string {
  const eventTitle = title.trim() || String(i18n.t("messages.speakKindEvent"));
  return String(
    i18n.t("messages.voiceTriggerReason", { lead: leadPhrase, title: eventTitle }),
  );
}

/** Test helper: reset in-memory history cache between cases. */
export function resetNotifyHistoryCacheForTests(): void {
  cachedEntries = null;
  hydrateHistoryPromise = null;
}
