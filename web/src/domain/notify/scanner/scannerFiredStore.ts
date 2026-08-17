import {
  claimVoiceReminderFired,
  fetchVoiceReminderFired,
  putVoiceReminderFired,
} from "../../../api/uiPrefs";
import { logWarn } from "../../../utils/logger";

let cachedFiredKeys: Set<string> | null = null;
let hydrateFiredPromise: Promise<Set<string>> | null = null;

function setFiredCache(keys: ReadonlySet<string>): void {
  cachedFiredKeys = new Set(keys);
}

/** Sync read from memory cache (empty set before hydrate). */
export function loadFiredKeys(): Set<string> {
  if (cachedFiredKeys) {
    return new Set(cachedFiredKeys);
  }
  return new Set();
}

/** Hydrate fired keys from server. Empty server → empty set. */
export async function hydrateFiredKeys(): Promise<Set<string>> {
  if (!hydrateFiredPromise) {
    hydrateFiredPromise = (async () => {
      try {
        const response = await fetchVoiceReminderFired();
        if (response.configured && Array.isArray(response.keys)) {
          const keys = new Set(response.keys);
          setFiredCache(keys);
          return loadFiredKeys();
        }

        setFiredCache(new Set());
        return loadFiredKeys();
      } catch (error) {
        logWarn("[voiceReminder] failed to hydrate fired keys", error);
        const fallback = loadFiredKeys();
        setFiredCache(fallback);
        return fallback;
      }
    })().finally(() => {
      hydrateFiredPromise = null;
    });
  }
  return hydrateFiredPromise;
}

/**
 * Persist fired keys to the server. Updates memory first so the scanner does
 * not re-announce; returns false on API failure (caller should toast/log).
 */
export async function saveFiredKeys(firedKeys: ReadonlySet<string>): Promise<boolean> {
  const keys = new Set(firedKeys);
  setFiredCache(keys);
  try {
    const saved = await putVoiceReminderFired([...keys]);
    if (Array.isArray(saved.keys)) {
      setFiredCache(new Set(saved.keys));
    }
    return true;
  } catch (error) {
    logWarn("[voiceReminder] failed to save fired keys", error);
    return false;
  }
}

/**
 * Reserve due keys on the server before TTS. Returns keys this client won
 * (others skip speak). Updates local cache from server ``keys``.
 */
export async function claimFiredKeys(keys: readonly string[]): Promise<Set<string>> {
  const uniqueKeys = [...new Set(keys)];
  if (uniqueKeys.length === 0) {
    return new Set();
  }
  try {
    const response = await claimVoiceReminderFired(uniqueKeys);
    if (Array.isArray(response.keys)) {
      setFiredCache(new Set(response.keys));
    }
    return new Set(response.claimed ?? []);
  } catch (error) {
    logWarn("[voiceReminder] failed to claim fired keys", error);
    return new Set();
  }
}

/** Test helper: reset in-memory fired cache between cases. */
export function resetFiredKeysCacheForTests(): void {
  cachedFiredKeys = null;
  hydrateFiredPromise = null;
}
