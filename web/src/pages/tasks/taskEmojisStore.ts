/**
 * Task card emojis backed by `/api/v1/ui-prefs/tasks/emojis`.
 * Keys are analysis task ids. Empty glyph omitted → default task logo.
 *
 * Saves must not be clobbered by an in-flight GET (pick → PUT while hydrate
 * still holds `{ configured: false }`).
 */

import { fetchTaskEmojis, putTaskEmojis } from "../../api/uiPrefs";
import { logWarn } from "../../utils/logger";

export type TaskEmojiMap = Record<string, string>;

let cached: TaskEmojiMap | null = null;
let hydratePromise: Promise<TaskEmojiMap> | null = null;
let saveGeneration = 0;
let pendingSaves = 0;
const listeners = new Set<() => void>();

function normalizeEmojis(raw: unknown): TaskEmojiMap {
  if (!raw || typeof raw !== "object") return {};
  const out: TaskEmojiMap = {};
  for (const [id, glyph] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof id !== "string" || !id.trim()) continue;
    if (typeof glyph !== "string") continue;
    const clean = glyph.trim();
    if (!clean || clean.length > 32) continue;
    out[id.trim()] = clean;
  }
  return out;
}

function notify(): void {
  for (const listener of listeners) listener();
}

function setCache(data: TaskEmojiMap): void {
  cached = { ...data };
  notify();
}

function shouldApplyRemote(gen: number, sawPendingSave: boolean): boolean {
  return pendingSaves === 0 && saveGeneration === gen && !sawPendingSave;
}

export function subscribeTaskEmojis(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function loadTaskEmojis(): TaskEmojiMap {
  return cached ? { ...cached } : {};
}

export async function hydrateTaskEmojis(): Promise<TaskEmojiMap> {
  if (!hydratePromise) {
    const gen = saveGeneration;
    const sawPendingSave = pendingSaves > 0;
    hydratePromise = (async () => {
      try {
        const response = await fetchTaskEmojis();
        if (!shouldApplyRemote(gen, sawPendingSave)) {
          return loadTaskEmojis();
        }
        if (response.configured && response.emojis != null) {
          const normalized = normalizeEmojis(response.emojis);
          setCache(normalized);
          return { ...normalized };
        }
        if (cached) return loadTaskEmojis();
        setCache({});
        return {};
      } catch (error) {
        logWarn("[taskEmojis] failed to hydrate", error);
        if (!shouldApplyRemote(gen, sawPendingSave) || cached) {
          return loadTaskEmojis();
        }
        setCache({});
        return {};
      }
    })().finally(() => {
      hydratePromise = null;
    });
  }
  return hydratePromise;
}

export async function saveTaskEmojis(data: TaskEmojiMap): Promise<boolean> {
  const previous = loadTaskEmojis();
  const normalized = normalizeEmojis(data);
  pendingSaves += 1;
  saveGeneration += 1;
  const gen = saveGeneration;
  setCache(normalized);
  try {
    await putTaskEmojis({ emojis: normalized });
    return true;
  } catch (error) {
    logWarn("[taskEmojis] failed to save", error);
    if (saveGeneration === gen) {
      setCache(previous);
    }
    throw error;
  } finally {
    pendingSaves -= 1;
  }
}

export function seedTaskEmojisForTests(data: TaskEmojiMap): void {
  setCache(normalizeEmojis(data));
  hydratePromise = null;
}

export function resetTaskEmojisCacheForTests(): void {
  cached = null;
  hydratePromise = null;
  saveGeneration = 0;
  pendingSaves = 0;
  listeners.clear();
}
