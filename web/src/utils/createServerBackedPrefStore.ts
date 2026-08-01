import { logWarn } from "./logger";

export type ServerBackedPrefHydrateOptions<T> = {
  /** Fetch remote prefs; `configured` means server already has a value. */
  fetchRemote: () => Promise<{ configured: boolean; data: T | null | undefined }>;
  normalize: (raw: T | null | undefined) => T;
  defaults: () => T;
  /** Called whenever a value is chosen (remote / defaults / fallback). */
  setCache: (value: T) => void;
  logLabel: string;
};

/**
 * Shared hydrate: remote → defaults (no localStorage migrate into server).
 * Callers own dedupe (`hydratePromise`).
 */
export async function hydrateServerBackedPref<T>(
  options: ServerBackedPrefHydrateOptions<T>,
): Promise<T> {
  const {
    fetchRemote,
    normalize,
    defaults,
    setCache,
    logLabel,
  } = options;

  try {
    const response = await fetchRemote();
    if (response.configured && response.data != null) {
      const normalized = normalize(response.data);
      setCache(normalized);
      return normalized;
    }

    const fallback = defaults();
    setCache(fallback);
    return fallback;
  } catch (error) {
    logWarn(`[${logLabel}] failed to hydrate`, error);
    const fallback = defaults();
    setCache(fallback);
    return fallback;
  }
}
