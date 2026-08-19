/**
 * Schedule card emojis backed by `/api/v1/ui-prefs/schedule/emojis`.
 * Keys are `oneOff:<id>` / `recurring:<id>` (see scheduleEmojiStorageKey).
 */

import { fetchScheduleEmojis, putScheduleEmojis } from "../../api/uiPrefs";
import { hydrateServerBackedPref } from "../../utils/createServerBackedPrefStore";
import { logWarn } from "../../utils/logger";

export type ScheduleEmojiMap = Record<string, string>;

let cached: ScheduleEmojiMap | null = null;
let hydratePromise: Promise<ScheduleEmojiMap> | null = null;

function normalizeEmojis(raw: unknown): ScheduleEmojiMap {
  if (!raw || typeof raw !== "object") return {};
  const out: ScheduleEmojiMap = {};
  for (const [id, glyph] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof id !== "string" || !id.trim()) continue;
    if (typeof glyph !== "string") continue;
    const clean = glyph.trim();
    if (!clean || clean.length > 32) continue;
    out[id.trim()] = clean;
  }
  return out;
}

function setCache(data: ScheduleEmojiMap): void {
  cached = { ...data };
}

export function loadScheduleEmojis(): ScheduleEmojiMap {
  return cached ? { ...cached } : {};
}

export async function hydrateScheduleEmojis(): Promise<ScheduleEmojiMap> {
  if (!hydratePromise) {
    hydratePromise = hydrateServerBackedPref<ScheduleEmojiMap>({
      fetchRemote: async () => {
        const response = await fetchScheduleEmojis();
        if (!response.configured) {
          return { configured: false, data: null };
        }
        return { configured: true, data: normalizeEmojis(response.emojis) };
      },
      normalize: normalizeEmojis,
      defaults: () => ({}),
      setCache,
      logLabel: "scheduleEmojis",
    }).then((normalized) => ({ ...normalized })).finally(() => {
      hydratePromise = null;
    });
  }
  return hydratePromise;
}

export async function saveScheduleEmojis(data: ScheduleEmojiMap): Promise<boolean> {
  const normalized = normalizeEmojis(data);
  setCache(normalized);
  try {
    await putScheduleEmojis({ emojis: normalized });
    return true;
  } catch (error) {
    logWarn("[scheduleEmojis] failed to save", error);
    return false;
  }
}

export function resetScheduleEmojisCacheForTests(): void {
  cached = null;
  hydratePromise = null;
}
