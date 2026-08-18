import {
  fetchNotifySettings,
  putNotifySettings,
  type NotifySettingsPayload,
} from "../../../api/uiPrefs";
import { logWarn } from "../../../utils/logger";
import {
  DEFAULT_PREAMBLE_CHIME_ID,
  sanitizePreambleChimeId,
  type PreambleChimeId,
} from "./preambleChime";

import { NOTIFY_SETTINGS_CHANGED_EVENT } from "../../prefs";

/** Same-tab signal so the App-level scanner can re-run immediately after save. */
export { NOTIFY_SETTINGS_CHANGED_EVENT };

/** Common shortcuts that fill the minutes input — not a closed catalog. */
export const LEAD_OFFSET_OPTIONS = [15, 60, 240, 1440] as const;

export const LEAD_OFFSET_MIN_MINUTES = 1;
/** Seven days in minutes; scanner fetch window follows the max stored offset. */
export const LEAD_OFFSET_MAX_MINUTES = 7 * 24 * 60;

export type LeadOffsetMinutes = number;

/** Positive integer minutes in ``[1, 10080]``. Strings from the form are accepted. */
export function parseLeadOffsetMinutes(value: unknown): number | null {
  if (typeof value === "boolean") {
    return null;
  }
  let n: number;
  if (typeof value === "number") {
    n = value;
  } else if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    n = Number(trimmed);
  } else {
    return null;
  }
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    return null;
  }
  if (n < LEAD_OFFSET_MIN_MINUTES || n > LEAD_OFFSET_MAX_MINUTES) {
    return null;
  }
  return n;
}

export type { PreambleChimeId };

/**
 * Sanitized domain settings derived from OpenAPI ``NotifySettingsSchema``.
 * ``sourceFilter`` leftover in prefs JSON is ignored (not read or written).
 */
export type NotifyFlashMode = "timed" | "persistent";

export type NotifySettings = {
  enabled: NotifySettingsPayload["enabled"];
  /** TTS / spoken reminder. Independent of flash. Missing prefs → on. */
  voiceEnabled: boolean;
  /** Dedicated top-bar flash. Independent of voice. Missing prefs → on. */
  flashEnabled: boolean;
  /** Timed auto-dismiss vs stay until dismiss. Missing prefs → timed. */
  flashMode: NotifyFlashMode;
  leadOffsetsMinutes: number[];
  preambleChimeId: PreambleChimeId;
  quietHours: NonNullable<NotifySettingsPayload["quietHours"]>;
};

export const DEFAULT_NOTIFY_SETTINGS: NotifySettings = {
  enabled: false,
  voiceEnabled: true,
  flashEnabled: true,
  flashMode: "timed",
  leadOffsetsMinutes: [60],
  preambleChimeId: DEFAULT_PREAMBLE_CHIME_ID,
  quietHours: { enabled: true, start: "22:00", end: "07:00" },
};

function sanitizeBool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function sanitizeFlashMode(value: unknown): NotifyFlashMode {
  return value === "persistent" ? "persistent" : "timed";
}

/** Channel plan after master / DND already allowed the scan. Inbox is not a channel. */
export function reminderChannelDelivery(
  settings: Pick<NotifySettings, "voiceEnabled" | "flashEnabled" | "flashMode">,
): { speak: boolean; flash: boolean; flashPersist: boolean } {
  return {
    speak: settings.voiceEnabled,
    flash: settings.flashEnabled,
    flashPersist: settings.flashMode === "persistent",
  };
}

let cachedSettings: NotifySettings | null = null;
let hydratePromise: Promise<NotifySettings> | null = null;

/** Unique sorted minutes; empty / all-invalid → default ``[60]``. */
export function sanitizeLeadOffsets(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [...DEFAULT_NOTIFY_SETTINGS.leadOffsetsMinutes];
  }
  const seen = new Set<number>();
  for (const item of value) {
    const parsed = parseLeadOffsetMinutes(item);
    if (parsed != null) {
      seen.add(parsed);
    }
  }
  if (seen.size === 0) {
    return [...DEFAULT_NOTIFY_SETTINGS.leadOffsetsMinutes];
  }
  return [...seen].sort((a, b) => a - b);
}

function sanitizeTime(value: unknown, fallback: string): string {
  return typeof value === "string" && /^\d{2}:\d{2}$/.test(value) ? value : fallback;
}

function sanitizeQuietHours(value: unknown): NotifySettings["quietHours"] {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    // Existing installs had no switch; retain their existing quiet-hours behaviour.
    enabled:
      typeof raw.enabled === "boolean"
        ? raw.enabled
        : DEFAULT_NOTIFY_SETTINGS.quietHours.enabled,
    start: sanitizeTime(raw.start, DEFAULT_NOTIFY_SETTINGS.quietHours.start),
    end: sanitizeTime(raw.end, DEFAULT_NOTIFY_SETTINGS.quietHours.end),
  };
}

function cloneDefaults(): NotifySettings {
  return {
    ...DEFAULT_NOTIFY_SETTINGS,
    leadOffsetsMinutes: [...DEFAULT_NOTIFY_SETTINGS.leadOffsetsMinutes],
    quietHours: { ...DEFAULT_NOTIFY_SETTINGS.quietHours },
  };
}

function toPayload(settings: NotifySettings): NotifySettingsPayload {
  return {
    enabled: settings.enabled,
    voiceEnabled: settings.voiceEnabled,
    flashEnabled: settings.flashEnabled,
    flashMode: settings.flashMode,
    leadOffsetsMinutes: [...settings.leadOffsetsMinutes],
    preambleChimeId: settings.preambleChimeId,
    quietHours: { ...settings.quietHours },
  };
}

/** Normalize a partial/raw settings object (API payload). Ignores leftover ``sourceFilter``. */
export function normalizeNotifySettings(
  raw: Partial<NotifySettings> | Record<string, unknown> | null | undefined,
): NotifySettings {
  const parsed = (raw ?? {}) as Partial<NotifySettings>;
  return {
    enabled:
      typeof parsed.enabled === "boolean"
        ? parsed.enabled
        : DEFAULT_NOTIFY_SETTINGS.enabled,
    voiceEnabled: sanitizeBool(parsed.voiceEnabled, DEFAULT_NOTIFY_SETTINGS.voiceEnabled),
    flashEnabled: sanitizeBool(parsed.flashEnabled, DEFAULT_NOTIFY_SETTINGS.flashEnabled),
    flashMode: sanitizeFlashMode(parsed.flashMode),
    leadOffsetsMinutes: sanitizeLeadOffsets(parsed.leadOffsetsMinutes),
    preambleChimeId: sanitizePreambleChimeId(parsed.preambleChimeId),
    quietHours: sanitizeQuietHours(parsed.quietHours),
  };
}

function setCache(settings: NotifySettings, notify: boolean): void {
  cachedSettings = {
    enabled: settings.enabled,
    voiceEnabled: settings.voiceEnabled,
    flashEnabled: settings.flashEnabled,
    flashMode: settings.flashMode,
    leadOffsetsMinutes: [...settings.leadOffsetsMinutes],
    preambleChimeId: settings.preambleChimeId,
    quietHours: { ...settings.quietHours },
  };
  if (notify && typeof window !== "undefined") {
    window.dispatchEvent(new Event(NOTIFY_SETTINGS_CHANGED_EVENT));
  }
}

/** Sync read from memory cache (defaults before hydrate). */
export function loadNotifySettings(): NotifySettings {
  if (cachedSettings) {
    return {
      enabled: cachedSettings.enabled,
      voiceEnabled: cachedSettings.voiceEnabled,
      flashEnabled: cachedSettings.flashEnabled,
      flashMode: cachedSettings.flashMode,
      leadOffsetsMinutes: [...cachedSettings.leadOffsetsMinutes],
      preambleChimeId: cachedSettings.preambleChimeId,
      quietHours: { ...cachedSettings.quietHours },
    };
  }
  return cloneDefaults();
}

/** Hydrate from server. Empty server → defaults. */
export async function hydrateNotifySettings(): Promise<NotifySettings> {
  if (!hydratePromise) {
    hydratePromise = (async () => {
      try {
        const response = await fetchNotifySettings();
        if (response.configured && response.settings) {
          const normalized = normalizeNotifySettings(response.settings);
          setCache(normalized, true);
          return loadNotifySettings();
        }

        const defaults = cloneDefaults();
        setCache(defaults, false);
        return loadNotifySettings();
      } catch (error) {
        logWarn("[notify] failed to hydrate settings", error);
        const fallback = loadNotifySettings();
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
export async function saveNotifySettings(
  settings: NotifySettings,
): Promise<boolean> {
  const normalized = normalizeNotifySettings(settings);
  try {
    const saved = await putNotifySettings(toPayload(normalized));
    const fromServer = normalizeNotifySettings(saved.settings ?? normalized);
    setCache(fromServer, true);
    return true;
  } catch (error) {
    logWarn("[notify] failed to save settings", error);
    return false;
  }
}

/** Test helper: reset in-memory cache between cases. */
export function resetNotifySettingsCacheForTests(): void {
  cachedSettings = null;
  hydratePromise = null;
}
