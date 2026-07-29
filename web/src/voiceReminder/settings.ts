import {
  fetchVoiceReminderSettings,
  putVoiceReminderSettings,
} from "../api/uiPrefs";
import { logWarn } from "../utils/logger";
import {
  DEFAULT_PREAMBLE_CHIME_ID,
  sanitizePreambleChimeId,
  type PreambleChimeId,
} from "./preambleChime";

import { VOICE_REMINDER_SETTINGS_CHANGED_EVENT } from "./voiceReminderPersistedKeys";

/** Same-tab signal so the App-level scanner can re-run immediately after save. */
export { VOICE_REMINDER_SETTINGS_CHANGED_EVENT };

/** Fixed lead-time options (minutes before event start). */
export const LEAD_OFFSET_OPTIONS = [15, 60, 240, 1440] as const;

export type LeadOffsetMinutes = (typeof LEAD_OFFSET_OPTIONS)[number];

export type { PreambleChimeId };

export interface VoiceReminderSettings {
  /** When false, the background scanner does nothing. */
  enabled: boolean;
  /** Minutes before start to speak; multi-select from LEAD_OFFSET_OPTIONS. */
  leadOffsetsMinutes: LeadOffsetMinutes[];
  /**
   * Task ids (event / recurring / calendar_task) and `__user__` whose timed items to watch.
   * Empty = all reminder sources. Default is `["__user__"]` (用戶或助手 only).
   */
  taskIds: string[];
  /** Attention chime played before TTS. */
  preambleChimeId: PreambleChimeId;
  /** Local quiet period; reminders remain pending until its next eligible scan. */
  quietHours: { enabled: boolean; start: string; end: string };
}

export const DEFAULT_VOICE_REMINDER_SETTINGS: VoiceReminderSettings = {
  enabled: false,
  leadOffsetsMinutes: [60],
  taskIds: ["__user__"],
  preambleChimeId: DEFAULT_PREAMBLE_CHIME_ID,
  quietHours: { enabled: true, start: "22:00", end: "07:00" },
};

const LEAD_SET = new Set<number>(LEAD_OFFSET_OPTIONS);

let cachedSettings: VoiceReminderSettings | null = null;
let hydratePromise: Promise<VoiceReminderSettings> | null = null;

function isLeadOffset(value: unknown): value is LeadOffsetMinutes {
  return typeof value === "number" && LEAD_SET.has(value);
}

function sanitizeLeadOffsets(value: unknown): LeadOffsetMinutes[] {
  if (!Array.isArray(value)) {
    return [...DEFAULT_VOICE_REMINDER_SETTINGS.leadOffsetsMinutes];
  }
  const seen = new Set<LeadOffsetMinutes>();
  for (const item of value) {
    if (isLeadOffset(item)) {
      seen.add(item);
    }
  }
  return LEAD_OFFSET_OPTIONS.filter((offset) => seen.has(offset));
}

function sanitizeTaskIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [...DEFAULT_VOICE_REMINDER_SETTINGS.taskIds];
  }
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item === "string" && item.trim() && !seen.has(item)) {
      seen.add(item);
      ids.push(item);
    }
  }
  return ids;
}

function sanitizeTime(value: unknown, fallback: string): string {
  return typeof value === "string" && /^\d{2}:\d{2}$/.test(value) ? value : fallback;
}

function sanitizeQuietHours(value: unknown): VoiceReminderSettings["quietHours"] {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    // Existing installs had no switch; retain their existing quiet-hours behaviour.
    enabled:
      typeof raw.enabled === "boolean"
        ? raw.enabled
        : DEFAULT_VOICE_REMINDER_SETTINGS.quietHours.enabled,
    start: sanitizeTime(raw.start, DEFAULT_VOICE_REMINDER_SETTINGS.quietHours.start),
    end: sanitizeTime(raw.end, DEFAULT_VOICE_REMINDER_SETTINGS.quietHours.end),
  };
}

function cloneDefaults(): VoiceReminderSettings {
  return {
    ...DEFAULT_VOICE_REMINDER_SETTINGS,
    leadOffsetsMinutes: [...DEFAULT_VOICE_REMINDER_SETTINGS.leadOffsetsMinutes],
    taskIds: [...DEFAULT_VOICE_REMINDER_SETTINGS.taskIds],
    quietHours: { ...DEFAULT_VOICE_REMINDER_SETTINGS.quietHours },
  };
}

/** Normalize a partial/raw settings object (API payload). */
export function normalizeVoiceReminderSettings(
  raw: Partial<VoiceReminderSettings> | Record<string, unknown> | null | undefined,
): VoiceReminderSettings {
  const parsed = (raw ?? {}) as Partial<VoiceReminderSettings>;
  return {
    enabled:
      typeof parsed.enabled === "boolean"
        ? parsed.enabled
        : DEFAULT_VOICE_REMINDER_SETTINGS.enabled,
    leadOffsetsMinutes: sanitizeLeadOffsets(parsed.leadOffsetsMinutes),
    taskIds: sanitizeTaskIds(parsed.taskIds),
    preambleChimeId: sanitizePreambleChimeId(parsed.preambleChimeId),
    quietHours: sanitizeQuietHours(parsed.quietHours),
  };
}

function setCache(settings: VoiceReminderSettings, notify: boolean): void {
  cachedSettings = {
    enabled: settings.enabled,
    leadOffsetsMinutes: [...settings.leadOffsetsMinutes],
    taskIds: [...settings.taskIds],
    preambleChimeId: settings.preambleChimeId,
    quietHours: { ...settings.quietHours },
  };
  if (notify && typeof window !== "undefined") {
    window.dispatchEvent(new Event(VOICE_REMINDER_SETTINGS_CHANGED_EVENT));
  }
}

/** Sync read from memory cache (defaults before hydrate). */
export function loadVoiceReminderSettings(): VoiceReminderSettings {
  if (cachedSettings) {
    return {
      enabled: cachedSettings.enabled,
      leadOffsetsMinutes: [...cachedSettings.leadOffsetsMinutes],
      taskIds: [...cachedSettings.taskIds],
      preambleChimeId: cachedSettings.preambleChimeId,
      quietHours: { ...cachedSettings.quietHours },
    };
  }
  return cloneDefaults();
}

/** Hydrate from server. Empty server → defaults. */
export async function hydrateVoiceReminderSettings(): Promise<VoiceReminderSettings> {
  if (!hydratePromise) {
    hydratePromise = (async () => {
      try {
        const response = await fetchVoiceReminderSettings();
        if (response.configured && response.settings) {
          const normalized = normalizeVoiceReminderSettings(response.settings);
          setCache(normalized, true);
          return loadVoiceReminderSettings();
        }

        const defaults = cloneDefaults();
        setCache(defaults, false);
        return loadVoiceReminderSettings();
      } catch (error) {
        logWarn("[voiceReminder] failed to hydrate settings", error);
        const fallback = loadVoiceReminderSettings();
        setCache(fallback, false);
        return fallback;
      }
    })().finally(() => {
      hydratePromise = null;
    });
  }
  return hydratePromise;
}

/**
 * Persist settings to the server-backed store.
 * Returns false on failure (caller should toast); keeps prior cache on failure.
 */
export async function saveVoiceReminderSettings(
  settings: VoiceReminderSettings,
): Promise<boolean> {
  const normalized = normalizeVoiceReminderSettings(settings);
  try {
    const saved = await putVoiceReminderSettings(normalized);
    const fromServer = normalizeVoiceReminderSettings(saved.settings ?? normalized);
    setCache(fromServer, true);
    return true;
  } catch (error) {
    logWarn("[voiceReminder] failed to save settings", error);
    return false;
  }
}

/** Test helper: reset in-memory cache between cases. */
export function resetVoiceReminderSettingsCacheForTests(): void {
  cachedSettings = null;
  hydratePromise = null;
}
